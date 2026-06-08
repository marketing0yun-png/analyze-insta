import "server-only";

import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto/token";
import { MetaApiError } from "@/lib/meta/client";
import { getHashtagQuota, runHashtagSearch } from "@/lib/meta/hashtag";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const JOBS = "analyze_insta_hashtag_jobs";
const RESULTS = "analyze_insta_hashtag_results";
const CREDENTIALS = "analyze_insta_api_credentials";
const CHANNEL = "instagram";

/**
 * GET — 최근 7일 쿼터 상태 + 최근 조회 이력(결과 수 포함).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { quota: null, jobs: [], reason: "unauthenticated" },
      { status: 200 }
    );
  }

  try {
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

    return NextResponse.json({ quota, jobs: mapped }, { status: 200 });
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
      { error: "세션이 없습니다. 익명 로그인 상태를 확인하세요." },
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
    if (!cred?.ig_user_id) {
      return NextResponse.json(
        { error: "먼저 인스타 토큰을 연결하세요." },
        { status: 400 }
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
