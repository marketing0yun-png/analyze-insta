import "server-only";

import { NextResponse } from "next/server";

import { AIError } from "@/lib/ai";
import { analyzeTrackedAccount } from "@/lib/ai/analyze-account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Vertex 인증(google-auth-library) → Node 런타임 강제. */
export const runtime = "nodejs";
/** AI 분석은 다소 길 수 있어 여유를 둔다. */
export const maxDuration = 60;

const ACCOUNTS = "analyze_insta_tracked_accounts";

/**
 * POST { id, reanalyze? } — 분석 대상의 수집 게시물을 AI 로 콘텐츠 분석.
 * 소유권은 RLS 클라이언트로 검증한 뒤, 수집·적재는 service-role 로 처리(collect 와 동일).
 * 기본은 증분(미분석만), reanalyze=true 면 전체 재분석.
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

  const body = (await req.json().catch(() => null)) as
    | { id?: unknown; reanalyze?: unknown }
    | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const reanalyze = body?.reanalyze === true;
  if (!id) {
    return NextResponse.json({ error: "대상 id 가 필요합니다." }, { status: 400 });
  }

  // 소유권 검증(RLS).
  const { data: account, error: accError } = await supabase
    .from(ACCOUNTS)
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (accError) {
    console.error("[api/accounts/analyze] 대상 조회 오류:", accError.message);
    return NextResponse.json({ error: "대상을 조회하지 못했습니다." }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const admin = createAdminClient();
    const result = await analyzeTrackedAccount(admin, id, { reanalyze });
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "서버 시크릿(SUPABASE_SERVICE_ROLE_KEY)이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    // Vertex/AI env 미설정은 친절히 그대로 노출(시크릿 값은 아님).
    if (message.startsWith("[env]")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    console.error("[api/accounts/analyze] 분석 오류:", message);
    return NextResponse.json({ error: "분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
