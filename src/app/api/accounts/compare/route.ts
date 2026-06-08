import "server-only";

import { NextResponse } from "next/server";

import { AIError } from "@/lib/ai";
import {
  type CompareSummary,
  compareAccounts,
  rankByEngagement,
  summarizeForCompare,
} from "@/lib/ai/compare-accounts";
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

/** 한 번에 비교할 계정 수 상한(프롬프트·비용 보호). */
const MAX_ACCOUNTS = 5;

/**
 * POST { ids: string[] } — 2~5개 분석 대상을 참여율 순위 + LLM 냉정 평가로 비교.
 * 소유권은 RLS(loadAccountReport)로 검증. 결과는 reports(kind='comparison')에 적재.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "세션이 없습니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { ids?: unknown; benchmarkIds?: unknown }
    | null;
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.filter((x): x is string => typeof x === "string"))]
    : [];
  if (ids.length < 2) {
    return NextResponse.json(
      { error: "비교하려면 계정을 2개 이상 선택하세요." },
      { status: 400 }
    );
  }
  if (ids.length > MAX_ACCOUNTS) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_ACCOUNTS}개까지 비교할 수 있습니다.` },
      { status: 400 }
    );
  }

  // 벤치마크(목표) 지정 — 비교 대상(ids) 안에 든 것만 인정.
  const benchmarkSet = new Set(
    Array.isArray(body?.benchmarkIds)
      ? body.benchmarkIds.filter(
          (x): x is string => typeof x === "string" && ids.includes(x)
        )
      : []
  );
  // 전부를 벤치마크로 두면 '개선 대상'이 없어 무의미 → 무시(자동 비교로 폴백).
  if (benchmarkSet.size >= ids.length) benchmarkSet.clear();

  try {
    // 1) 각 대상 로드(RLS — 소유 아니면 null).
    const reports = await Promise.all(
      ids.map((id) => loadAccountReport(supabase, id))
    );
    const missing = reports.some((r) => r === null);
    if (missing) {
      return NextResponse.json(
        { error: "일부 대상을 찾을 수 없습니다(소유권/존재 확인)." },
        { status: 404 }
      );
    }

    const summaries: CompareSummary[] = reports.map((r, i) =>
      summarizeForCompare(r!, benchmarkSet.has(ids[i]))
    );

    // 분석된 게시물이 전무하면 평가가 무의미 → 안내.
    const anyAnalyzed = summaries.some((s) => s.analyzedPosts > 0);
    if (!anyAnalyzed) {
      return NextResponse.json(
        {
          error:
            "선택한 계정에 콘텐츠 분석 결과가 없습니다. 먼저 각 계정에서 'AI 분석'을 실행하세요.",
        },
        { status: 400 }
      );
    }

    // 사용량 미터(D-024): LLM 풀(분석·비교 공용). 비교 1회 = 1칸. 두 티어 모두 제한.
    const admin = createAdminClient();
    const meter = await getMeterStatus(admin, user.id, "llm");
    if (!meter.allowed) {
      return NextResponse.json(
        { error: meterBlockedMessage(meter), meter },
        { status: 429 }
      );
    }

    // 2) LLM 냉정 평가.
    const report = await compareAccounts(summaries);
    const rankedSummaries = rankByEngagement(summaries);

    // LLM 호출 성공 → 1칸 소비.
    await recordUsage(admin, user.id, "llm");

    // 3) 이력 적재(reports — service-role, RLS insert 정책 없음).
    const { error: insError } = await admin.from(REPORTS).insert({
      user_id: user.id,
      kind: "comparison",
      payload: {
        account_ids: ids,
        benchmark_ids: [...benchmarkSet],
        summaries: rankedSummaries,
        report,
      },
    });
    if (insError) {
      // 적재 실패는 치명적이지 않음 — 결과는 그대로 반환하되 로그만.
      console.error("[api/accounts/compare] 리포트 적재 오류:", insError.message);
    }

    return NextResponse.json(
      { accounts: rankedSummaries, report },
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
    console.error("[api/accounts/compare] 비교 오류:", message);
    return NextResponse.json({ error: "비교 중 오류가 발생했습니다." }, { status: 500 });
  }
}
