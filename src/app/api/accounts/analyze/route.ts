import "server-only";

import { NextResponse } from "next/server";

import { AIError } from "@/lib/ai";
import { analyzeTrackedAccount } from "@/lib/ai/analyze-account";
import { getVisionEnabled } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getMeterStatus,
  meterBlockedMessage,
  recordUsage,
} from "@/lib/server/usage-meter";

/** Vertex 인증(google-auth-library) → Node 런타임 강제. */
export const runtime = "nodejs";
/** AI 분석은 다소 길 수 있어 여유를 둔다. */
export const maxDuration = 60;

const ACCOUNTS = "analyze_insta_tracked_accounts";

/** 한 요청당 분석 게시물 기본 청크(=content-analysis CHUNK_SIZE). 60초 한도 회피(D-023). */
const DEFAULT_LIMIT = 10;

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
    | {
        id?: unknown;
        reanalyze?: unknown;
        vision?: unknown;
        limit?: unknown;
        first?: unknown;
      }
    | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const reanalyze = body?.reanalyze === true;
  // 청크 반복(D-023)의 첫 호출만 LLM 미터를 소비한다(계정 1개 분석 = LLM 1회).
  // 연속 청크(first:false)는 같은 논리적 분석이라 추가 차감 안 함. 미지정이면 첫 호출로 간주.
  const first = body?.first !== false;
  // 명시값(요청) > 서버 기본(env). 비전 끄려면 vision:false.
  const vision = typeof body?.vision === "boolean" ? body.vision : getVisionEnabled();
  // 한 요청에 처리할 게시물 수. Vercel 60초/요청 한도 회피를 위해 기본 10개씩 쪼개
  // 처리하고, 클라가 remaining 이 0 될 때까지 반복 호출한다(D-023). 0/미지정이면 기본.
  const limit =
    typeof body?.limit === "number" && body.limit > 0 ? body.limit : DEFAULT_LIMIT;
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

    // 사용량 미터(D-024): LLM 풀(분석·비교 공용)을 첫 청크에서만 확인. 막혔으면 시작 자체를 차단.
    if (first) {
      const meter = await getMeterStatus(admin, user.id, "llm");
      if (!meter.allowed) {
        return NextResponse.json(
          { error: meterBlockedMessage(meter), meter },
          { status: 429 }
        );
      }
    }

    const result = await analyzeTrackedAccount(admin, id, {
      reanalyze,
      vision,
      limit,
    });

    // 첫 청크에서 실제로 분석이 일어났을 때만 1칸 소비(이미 전부 분석된 no-op 은 무과금).
    if (first && result.analyzed > 0) {
      await recordUsage(admin, user.id, "llm");
    }

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
