import "server-only";

import { NextResponse } from "next/server";

import {
  type ContentAnalysisRow,
  computeContentInsights,
} from "@/lib/analytics/content-insights";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ACCOUNTS = "analyze_insta_tracked_accounts";
const MEDIA = "analyze_insta_media_posts";
const METRICS = "analyze_insta_post_metrics";
const ANALYSIS = "analyze_insta_content_analysis";

type MetricRow = {
  captured_at: string;
  like_count: number | null;
  comments_count: number | null;
};

type AnalysisRow = {
  model: string | null;
  analyzed_at: string | null;
  topic: string | null;
  appeal_points: unknown;
  format: string | null;
  tone: string | null;
  summary: string | null;
  keywords: unknown;
  visual_notes: string | null;
};

type MediaRow = {
  external_media_id: string;
  permalink: string | null;
  caption: string | null;
  posted_at: string | null;
  metrics: MetricRow[] | null;
  analysis: AnalysisRow[] | null;
};

function latestMetric(metrics: MetricRow[] | null): MetricRow | null {
  if (!metrics || metrics.length === 0) return null;
  return [...metrics].sort(
    (a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at)
  )[0];
}

/** 한 게시물의 최신 분석(analyzed_at 내림차순 첫 행). */
function latestAnalysis(rows: AnalysisRow[] | null): AnalysisRow | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort(
    (a, b) => Date.parse(b.analyzed_at ?? "") - Date.parse(a.analyzed_at ?? "")
  )[0];
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/**
 * GET ?id=... — 분석 대상 1개의 AI 콘텐츠 인사이트(집계 + 게시물별).
 * RLS 로 본인 소유만 접근. content_analysis 가 비면 빈 인사이트.
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

  const { data: account, error: accError } = await supabase
    .from(ACCOUNTS)
    .select("id, username")
    .eq("id", id)
    .maybeSingle();
  if (accError) {
    console.error("[api/accounts/insights] 대상 조회 오류:", accError.message);
    return NextResponse.json({ error: "조회 실패." }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  // 게시물 + 최신 지표 + 분석(임베드, RLS).
  const { data: mediaRows, error: mediaError } = await supabase
    .from(MEDIA)
    .select(
      `external_media_id, permalink, caption, posted_at,
       metrics:${METRICS}(captured_at, like_count, comments_count),
       analysis:${ANALYSIS}(model, analyzed_at, topic, appeal_points, format, tone, summary, keywords, visual_notes)`
    )
    .eq("tracked_account_id", id)
    .order("posted_at", { ascending: false });
  if (mediaError) {
    console.error("[api/accounts/insights] 게시물 조회 오류:", mediaError.message);
    return NextResponse.json({ error: "조회 실패." }, { status: 500 });
  }

  // 분석이 존재하는 게시물만 인사이트 대상으로.
  const rows: ContentAnalysisRow[] = ((mediaRows ?? []) as MediaRow[])
    .map((m) => {
      const a = latestAnalysis(m.analysis);
      if (!a) return null;
      const metric = latestMetric(m.metrics);
      return {
        externalMediaId: m.external_media_id,
        permalink: m.permalink,
        caption: m.caption,
        postedAt: m.posted_at,
        likeCount: metric?.like_count ?? null,
        commentsCount: metric?.comments_count ?? null,
        model: a.model,
        analyzedAt: a.analyzed_at,
        topic: a.topic,
        appealPoints: asStringArray(a.appeal_points),
        format: a.format,
        tone: a.tone,
        summary: a.summary,
        keywords: asStringArray(a.keywords),
        visualNotes: a.visual_notes,
      } satisfies ContentAnalysisRow;
    })
    .filter((r): r is ContentAnalysisRow => r !== null);

  const insights = computeContentInsights(rows);

  return NextResponse.json(
    {
      account: { id: account.id, username: account.username },
      insights,
    },
    { status: 200 }
  );
}
