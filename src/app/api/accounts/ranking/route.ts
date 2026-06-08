import "server-only";

import { NextResponse } from "next/server";

import { loadAccountReport } from "@/lib/server/account-report";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ACCOUNTS = "analyze_insta_tracked_accounts";

/**
 * GET /api/accounts/ranking — 사용자의 모든 분석 대상을 **참여율 내림차순**으로.
 * 비교 화면의 리더보드 + 선택용. RLS 로 본인 소유만.
 * 참여율이 null(수집 전/팔로워 미상)인 계정은 맨 뒤.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "세션이 없습니다." }, { status: 401 });
  }

  const { data: accounts, error } = await supabase
    .from(ACCOUNTS)
    .select("id")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[api/accounts/ranking] 목록 조회 오류:", error.message);
    return NextResponse.json({ error: "조회 실패." }, { status: 500 });
  }

  const ids = (accounts ?? []).map((a) => a.id as string);
  const reports = await Promise.all(
    ids.map((id) => loadAccountReport(supabase, id))
  );

  const items = reports
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({
      id: r.account.id,
      username: r.account.username,
      account_kind: r.account.account_kind,
      followers: r.followers,
      engagementRate: r.metrics.engagementRate,
      avgLikes: r.metrics.avgLikes,
      avgComments: r.metrics.avgComments,
      postsPerWeek: r.metrics.postsPerWeek,
      collectedPosts: r.collectedPosts,
      analyzedPosts: r.insights.analyzedPosts,
    }))
    .sort((a, b) => {
      const ea = a.engagementRate ?? -1;
      const eb = b.engagementRate ?? -1;
      if (eb !== ea) return eb - ea;
      const ra = (a.avgLikes ?? 0) + (a.avgComments ?? 0);
      const rb = (b.avgLikes ?? 0) + (b.avgComments ?? 0);
      return rb - ra;
    });

  return NextResponse.json({ items }, { status: 200 });
}
