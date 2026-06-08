import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type AccountMetrics,
  type MediaKind,
  type PostInput,
  computeAccountMetrics,
} from "@/lib/analytics/account-metrics";
import {
  type ContentAnalysisRow,
  type ContentInsights,
  computeContentInsights,
} from "@/lib/analytics/content-insights";

/**
 * 계정 1개의 지표 + 콘텐츠 인사이트를 **한 번에** 로드하는 공용 서버 헬퍼.
 * 비교(/compare)·순위(/ranking) 라우트가 공유한다. 전달된 클라이언트의 권한
 * (RLS 사용자 또는 service-role)을 그대로 따른다 — 소유권은 호출부가 책임진다.
 */

const ACCOUNTS = "analyze_insta_tracked_accounts";
const SNAPSHOTS = "analyze_insta_account_snapshots";
const MEDIA = "analyze_insta_media_posts";
const METRICS = "analyze_insta_post_metrics";
const ANALYSIS = "analyze_insta_content_analysis";

export type AccountRef = {
  id: string;
  username: string;
  account_kind: "competitor" | "influencer" | "owned";
  access_tier: "public" | "delegated";
};

export type AccountReport = {
  account: AccountRef;
  followers: number | null;
  collectedPosts: number;
  metrics: AccountMetrics;
  insights: ContentInsights;
};

type MetricRow = {
  captured_at: string;
  like_count: number | null;
  comments_count: number | null;
  reach: number | null;
  impressions: number | null;
  saved: number | null;
  video_views: number | null;
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
  media_type: MediaKind | null;
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

/** 대상 1개를 로드. 소유/존재하지 않으면(RLS 차단 포함) null. */
export async function loadAccountReport(
  supabase: SupabaseClient,
  id: string
): Promise<AccountReport | null> {
  const { data: account, error: accError } = await supabase
    .from(ACCOUNTS)
    .select("id, username, account_kind, access_tier")
    .eq("id", id)
    .maybeSingle();
  if (accError) throw accError;
  if (!account) return null;

  const { data: snap } = await supabase
    .from(SNAPSHOTS)
    .select("followers_count")
    .eq("tracked_account_id", id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: mediaRows, error: mediaError } = await supabase
    .from(MEDIA)
    .select(
      `external_media_id, permalink, caption, media_type, posted_at,
       metrics:${METRICS}(captured_at, like_count, comments_count, reach, impressions, saved, video_views),
       analysis:${ANALYSIS}(model, analyzed_at, topic, appeal_points, format, tone, summary, keywords, visual_notes)`
    )
    .eq("tracked_account_id", id)
    .order("posted_at", { ascending: false });
  if (mediaError) throw mediaError;

  const rows = (mediaRows ?? []) as MediaRow[];

  const posts: PostInput[] = rows.map((m) => {
    const latest = latestMetric(m.metrics);
    return {
      externalMediaId: m.external_media_id,
      permalink: m.permalink,
      caption: m.caption,
      mediaType: m.media_type,
      postedAt: m.posted_at,
      likeCount: latest?.like_count ?? null,
      commentsCount: latest?.comments_count ?? null,
      reach: latest?.reach ?? null,
      impressions: latest?.impressions ?? null,
      saved: latest?.saved ?? null,
      videoViews: latest?.video_views ?? null,
    };
  });

  const analysisRows: ContentAnalysisRow[] = rows
    .map((m) => {
      const a = latestAnalysis(m.analysis);
      if (!a) return null;
      const latest = latestMetric(m.metrics);
      return {
        externalMediaId: m.external_media_id,
        permalink: m.permalink,
        caption: m.caption,
        postedAt: m.posted_at,
        likeCount: latest?.like_count ?? null,
        commentsCount: latest?.comments_count ?? null,
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

  const followers = snap?.followers_count ?? null;

  return {
    account: account as AccountRef,
    followers,
    collectedPosts: posts.length,
    metrics: computeAccountMetrics(posts, followers),
    insights: computeContentInsights(analysisRows),
  };
}
