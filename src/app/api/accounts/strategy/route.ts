import "server-only";

import { NextResponse } from "next/server";

import { AIError } from "@/lib/ai";
import { summarizeForCompare } from "@/lib/ai/compare-accounts";
import { type AccountDiagnosis, diagnoseAccount } from "@/lib/ai/diagnose-account";
import { loadAccountReport } from "@/lib/server/account-report";
import {
  getMeterStatus,
  meterBlockedMessage,
  recordUsage,
} from "@/lib/server/usage-meter";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const REPORTS = "analyze_insta_reports";

/** 이 계정의 최신 진단 캐시(reports.kind='diagnosis')를 admin 으로 조회. */
async function loadCachedDiagnosis(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  accountId: string
): Promise<{ diagnosis: AccountDiagnosis; createdAt: string | null } | null> {
  const { data, error } = await admin
    .from(REPORTS)
    .select("payload, generated_at")
    .eq("user_id", userId)
    .eq("kind", "diagnosis")
    .eq("payload->>account_id", accountId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const payload = (data.payload ?? {}) as { diagnosis?: AccountDiagnosis };
  if (!payload.diagnosis) return null;
  return { diagnosis: payload.diagnosis, createdAt: data.generated_at ?? null };
}

/**
 * GET ?id=... — 단일 계정 전략 진단의 **캐시된 결과**(있으면) + 미터 상태.
 * 분석 결과가 없으면 diagnosis=null 로 반환(클라가 '진단 실행' 버튼 노출).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "세션이 없습니다." }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id 가 필요합니다." }, { status: 400 });
  }

  try {
    const report = await loadAccountReport(supabase, id);
    if (!report) {
      return NextResponse.json(
        { error: "대상을 찾을 수 없습니다(소유권/존재 확인)." },
        { status: 404 }
      );
    }
    const admin = createAdminClient();
    const [cached, meter] = await Promise.all([
      loadCachedDiagnosis(admin, user.id, id),
      getMeterStatus(admin, user.id, "llm"),
    ]);
    return NextResponse.json(
      {
        account: { id: report.account.id, username: report.account.username },
        analyzedPosts: report.insights.analyzedPosts,
        diagnosis: cached?.diagnosis ?? null,
        diagnosedAt: cached?.createdAt ?? null,
        meter,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
    console.error("[api/accounts/strategy] GET 오류:", message);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * POST { id } — 단일 계정 전략 진단을 LLM 으로 실행(분석·비교 미터 1칸 소비).
 * 결과는 reports(kind='diagnosis')에 적재(캐시).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "세션이 없습니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id 가 필요합니다." }, { status: 400 });
  }

  try {
    const report = await loadAccountReport(supabase, id);
    if (!report) {
      return NextResponse.json(
        { error: "대상을 찾을 수 없습니다(소유권/존재 확인)." },
        { status: 404 }
      );
    }
    if (report.insights.analyzedPosts === 0) {
      return NextResponse.json(
        {
          error:
            "콘텐츠 분석 결과가 없습니다. 먼저 '콘텐츠 인사이트' 탭에서 AI 분석을 실행하세요.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    // 분석·비교 미터(D-024) — 진단도 LLM 1회 → 같은 풀에서 1칸.
    const meter = await getMeterStatus(admin, user.id, "llm");
    if (!meter.allowed) {
      return NextResponse.json(
        { error: meterBlockedMessage(meter), meter },
        { status: 429 }
      );
    }

    const summary = summarizeForCompare(report);
    const diagnosis = await diagnoseAccount(summary);

    // LLM 호출 성공 → 1칸 소비.
    await recordUsage(admin, user.id, "llm");

    const { error: insError } = await admin.from(REPORTS).insert({
      user_id: user.id,
      kind: "diagnosis",
      payload: { account_id: id, summary, diagnosis },
    });
    if (insError) {
      console.error("[api/accounts/strategy] 리포트 적재 오류:", insError.message);
    }

    return NextResponse.json(
      {
        account: { id: report.account.id, username: report.account.username },
        analyzedPosts: report.insights.analyzedPosts,
        diagnosis,
        diagnosedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
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
    if (message.startsWith("[env]")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    console.error("[api/accounts/strategy] 진단 오류:", message);
    return NextResponse.json({ error: "진단 중 오류가 발생했습니다." }, { status: 500 });
  }
}
