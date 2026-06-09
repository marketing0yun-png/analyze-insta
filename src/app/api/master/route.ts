import "server-only";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isMaster } from "@/lib/server/master";
import { USAGE_WINDOW_MS } from "@/lib/server/usage-meter";

/** 전 사용자 조합 뷰는 service-role 필요 → Node 런타임. */
export const runtime = "nodejs";

const USERS = "analyze_insta_users";
const USAGE = "analyze_insta_usage_events";
const ACCOUNTS = "analyze_insta_tracked_accounts";
const CREDENTIALS = "analyze_insta_api_credentials";
const REQUESTS = "analyze_insta_hashtag_requests";
const CURATED = "analyze_insta_curated_hashtags";
const CHANNEL = "instagram";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 세션 + 마스터 권한 확인. 통과 시 admin 클라이언트 반환. */
async function requireMaster() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "세션이 없습니다.", status: 401 as const };
  if (!isMaster(user)) return { error: "마스터 권한이 없습니다.", status: 403 as const };
  return { admin: createAdminClient(), user };
}

/**
 * GET — 마스터 콘솔 집계(전 사용자 조합).
 * 사용자 수 / 사용량(2h·24h, action별) / 계정(종류별) / 개인토큰 수 /
 * 해시태그 신청(대기) / 큐레이션 목록.
 */
export async function GET() {
  const guard = await requireMaster();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { admin } = guard;

  try {
    const now = Date.now();
    const since24h = new Date(now - DAY_MS).toISOString();
    const window2hStart = now - USAGE_WINDOW_MS;

    const [
      usersRes,
      usageRes,
      accountsRes,
      credsRes,
      requestsRes,
      curatedRes,
    ] = await Promise.all([
      admin.from(USERS).select("id", { count: "exact", head: true }),
      admin
        .from(USAGE)
        .select("action, created_at")
        .gte("created_at", since24h),
      admin.from(ACCOUNTS).select("account_kind"),
      admin
        .from(CREDENTIALS)
        .select("id", { count: "exact", head: true })
        .eq("channel", CHANNEL),
      admin
        .from(REQUESTS)
        .select("id, user_id, keyword, status, note, requested_at")
        .eq("status", "requested")
        .order("requested_at", { ascending: false })
        .limit(100),
      admin
        .from(CURATED)
        .select("id, hashtag, note, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    // 사용량 집계(action별 · 2h/24h).
    const usage = { collect2h: 0, collect24h: 0, llm2h: 0, llm24h: 0 };
    for (const row of (usageRes.data ?? []) as Array<{
      action: string;
      created_at: string;
    }>) {
      const ts = Date.parse(row.created_at);
      const within2h = ts >= window2hStart;
      if (row.action === "collect") {
        usage.collect24h += 1;
        if (within2h) usage.collect2h += 1;
      } else if (row.action === "llm") {
        usage.llm24h += 1;
        if (within2h) usage.llm2h += 1;
      }
    }

    // 계정 종류별.
    const accounts = { owned: 0, competitor: 0, influencer: 0, other: 0 };
    for (const row of (accountsRes.data ?? []) as Array<{ account_kind: string }>) {
      if (row.account_kind === "owned") accounts.owned += 1;
      else if (row.account_kind === "competitor") accounts.competitor += 1;
      else if (row.account_kind === "influencer") accounts.influencer += 1;
      else accounts.other += 1;
    }

    return NextResponse.json(
      {
        users: usersRes.count ?? 0,
        personalTokens: credsRes.count ?? 0,
        usage,
        accounts,
        requests: requestsRes.data ?? [],
        curated: curatedRes.data ?? [],
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "서버 시크릿(SUPABASE_SERVICE_ROLE_KEY)이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    console.error("[api/master] GET 오류:", message);
    return NextResponse.json({ error: "집계 조회 실패." }, { status: 500 });
  }
}

/**
 * POST { action, ... } — 마스터 액션.
 *  - add_curated   { hashtag, note? }     큐레이션 해시태그 추가(공통 노출).
 *  - fulfill_request { id, addCurated? }   신청을 처리완료로 표시(+선택적 큐레이션 등록).
 *  - reject_request  { id, note? }         신청 반려.
 */
export async function POST(req: Request) {
  const guard = await requireMaster();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { admin } = guard;

  const body = (await req.json().catch(() => null)) as {
    action?: unknown;
    hashtag?: unknown;
    note?: unknown;
    id?: unknown;
    addCurated?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    if (action === "add_curated") {
      const hashtag =
        typeof body?.hashtag === "string"
          ? body.hashtag.trim().replace(/^#/, "").toLowerCase()
          : "";
      if (!hashtag) {
        return NextResponse.json({ error: "해시태그를 입력하세요." }, { status: 400 });
      }
      const note = typeof body?.note === "string" ? body.note.trim() || null : null;
      const { data, error } = await admin
        .from(CURATED)
        .insert({ hashtag, note })
        .select("id, hashtag, note, created_at")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, curated: data }, { status: 201 });
    }

    if (action === "fulfill_request" || action === "reject_request") {
      const id = typeof body?.id === "string" ? body.id : "";
      if (!id) {
        return NextResponse.json({ error: "신청 id 가 필요합니다." }, { status: 400 });
      }
      const status = action === "fulfill_request" ? "fulfilled" : "rejected";
      const note = typeof body?.note === "string" ? body.note.trim() || null : null;

      const { data: updated, error } = await admin
        .from(REQUESTS)
        .update({
          status,
          note,
          fulfilled_at: status === "fulfilled" ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select("id, keyword, status")
        .single();
      if (error) throw error;

      // 처리완료 시 키워드를 큐레이션에도 등록(요청 시).
      if (status === "fulfilled" && body?.addCurated === true && updated?.keyword) {
        await admin
          .from(CURATED)
          .insert({ hashtag: updated.keyword as string, note });
      }
      return NextResponse.json({ ok: true, request: updated }, { status: 200 });
    }

    return NextResponse.json({ error: "알 수 없는 action." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
    console.error("[api/master] POST 오류:", message);
    return NextResponse.json({ error: "처리 실패." }, { status: 500 });
  }
}
