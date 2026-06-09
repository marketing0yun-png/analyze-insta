import "server-only";

import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto/token";
import { MetaApiError } from "@/lib/meta/client";
import { getHashtagQuota, runHashtagSearch } from "@/lib/meta/hashtag";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveTier } from "@/lib/server/usage-meter";

export const runtime = "nodejs";

const JOBS = "analyze_insta_hashtag_jobs";
const RESULTS = "analyze_insta_hashtag_results";
const CREDENTIALS = "analyze_insta_api_credentials";
const REQUESTS = "analyze_insta_hashtag_requests";
const CURATED = "analyze_insta_curated_hashtags";
const CHANNEL = "instagram";

/**
 * GET — 티어별 해시태그 상태.
 *  - 공통: 마스터 큐레이션 해시태그(curated) + 본인 신청 이력(requests).
 *  - 개인 토큰: 7일 쿼터 + 본인 직접 조회 이력(jobs).
 *  - 체험: 직접 검색 불가 → quota=null, jobs=[]. 신청 + 큐레이션만.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { tier: null, quota: null, jobs: [], curated: [], requests: [], reason: "unauthenticated" },
      { status: 200 }
    );
  }

  try {
    let tier: "trial" | "personal" = "trial";
    try {
      tier = await resolveTier(createAdminClient(), user.id);
    } catch {
      // service-role 미설정 등 — 기본 trial 로 동작(직접 검색 비활성).
    }

    // 큐레이션(공통 노출) — 모든 티어.
    const { data: curatedRows } = await supabase
      .from(CURATED)
      .select("id, hashtag, note, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    // 본인 신청 이력.
    const { data: reqRows } = await supabase
      .from(REQUESTS)
      .select("id, keyword, status, note, requested_at")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(20);

    const curated = curatedRows ?? [];
    const requests = reqRows ?? [];

    // 개인 토큰만 직접 검색 쿼터·이력.
    if (tier !== "personal") {
      return NextResponse.json(
        { tier, quota: null, jobs: [], curated, requests },
        { status: 200 }
      );
    }

    const quota = await getHashtagQuota(supabase, user.id);
    const { data: jobs, error } = await supabase
      .from(JOBS)
      .select(
        `id, hashtag, hashtag_id, requested_at, status,
         results:${RESULTS}(count)`
      )
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(20);
    if (error) throw error;

    const mapped = (jobs ?? []).map((j) => ({
      id: j.id,
      hashtag: j.hashtag,
      hashtag_id: j.hashtag_id,
      requested_at: j.requested_at,
      status: j.status,
      result_count:
        (j.results as Array<{ count: number }> | null)?.[0]?.count ?? 0,
    }));

    return NextResponse.json(
      { tier, quota, jobs: mapped, curated, requests },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api/hashtags] GET 오류:", err);
    return NextResponse.json({ error: "조회 실패." }, { status: 500 });
  }
}

/**
 * POST { keyword, type? } — 해시태그 1건 검색·적재. 쿼터 초과 시 429.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. 구글로 로그인한 뒤 다시 시도하세요." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    keyword?: unknown;
    type?: unknown;
  } | null;
  const keyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword) {
    return NextResponse.json({ error: "해시태그를 입력하세요." }, { status: 400 });
  }
  const type = body?.type === "recent" ? "recent" : "top";

  try {
    const admin = createAdminClient();
    const { data: cred, error: credError } = await admin
      .from(CREDENTIALS)
      .select("id, encrypted_token, ig_user_id")
      .eq("user_id", user.id)
      .eq("channel", CHANNEL)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (credError) throw credError;

    // 체험(개인 토큰 없음) — 직접 검색 불가(쿼터는 개인 토큰 소유자 부담). 신청만 받는다.
    if (!cred?.ig_user_id) {
      const normalized = keyword.replace(/^#/, "").toLowerCase();
      const { error: reqErr } = await admin
        .from(REQUESTS)
        .insert({ user_id: user.id, keyword: normalized });
      if (reqErr) throw reqErr;
      return NextResponse.json(
        {
          ok: true,
          requested: true,
          keyword: normalized,
          message:
            "해시태그 검색은 개인 토큰이 필요해요. 신청을 접수했어요 — 운영자가 검색해 공통 목록에 올리면 보여집니다.",
        },
        { status: 202 }
      );
    }

    const token = decryptToken(cred.encrypted_token as string);

    const result = await runHashtagSearch(admin, {
      userId: user.id,
      credentialId: (cred.id as string) ?? null,
      token,
      igUserId: cred.ig_user_id as string,
      keyword,
      type,
    });

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    if (err instanceof MetaApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "서버 시크릿(SUPABASE_SERVICE_ROLE_KEY)이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    if (message.includes("TOKEN_ENCRYPTION_KEY")) {
      return NextResponse.json(
        { error: "토큰 암호화 키가 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    console.error("[api/hashtags] POST 오류:", message);
    return NextResponse.json({ error: "검색 중 오류가 발생했습니다." }, { status: 500 });
  }
}
