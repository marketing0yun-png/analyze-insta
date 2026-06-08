import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type ContentAnalysis,
  type PostForAnalysis,
  analyzeContent,
} from "./content-analysis";

/**
 * 계정 콘텐츠 분석 오케스트레이터 (Phase 2) — **서버 전용**.
 * 수집된 media_posts(+최신 지표)를 AI 로 분석해 content_analysis(가공)에 적재한다.
 * 기본은 **증분**(아직 분석 안 된 게시물만). reanalyze=true 면 대상 전체 재분석.
 *
 * 적재는 RLS 우회(가공 잡 권한)가 필요 → service-role(admin) 클라이언트를 받는다.
 * 호출부에서 tracked_account 소유권을 먼저 검증한 뒤 넘겨야 한다(collect.ts 와 동일 사상).
 */

const MEDIA = "analyze_insta_media_posts";
const METRICS = "analyze_insta_post_metrics";
const ANALYSIS = "analyze_insta_content_analysis";

/** 한 번에 분석할 게시물 상한(비용·시간 보호). 최신 게시물 우선. */
const MAX_POSTS = 30;

export type AnalyzeAccountResult = {
  analyzed: number;
  skipped: number;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

type MetricRow = {
  captured_at: string;
  like_count: number | null;
  comments_count: number | null;
};

type MediaRow = {
  id: string;
  external_media_id: string;
  caption: string | null;
  media_type: PostForAnalysis["mediaType"];
  posted_at: string | null;
  metrics: MetricRow[] | null;
};

function latestMetric(metrics: MetricRow[] | null): MetricRow | null {
  if (!metrics || metrics.length === 0) return null;
  return [...metrics].sort(
    (a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at)
  )[0];
}

export async function analyzeTrackedAccount(
  admin: SupabaseClient,
  accountId: string,
  opts: { reanalyze?: boolean } = {}
): Promise<AnalyzeAccountResult> {
  // 1) 대상 게시물 + 최신 지표(최신순, 상한 적용).
  const { data: mediaRows, error: mediaError } = await admin
    .from(MEDIA)
    .select(
      `id, external_media_id, caption, media_type, posted_at,
       metrics:${METRICS}(captured_at, like_count, comments_count)`
    )
    .eq("tracked_account_id", accountId)
    .order("posted_at", { ascending: false })
    .limit(MAX_POSTS);
  if (mediaError) throw mediaError;

  const rows = (mediaRows ?? []) as MediaRow[];
  if (rows.length === 0) {
    return { analyzed: 0, skipped: 0, model: null, inputTokens: null, outputTokens: null };
  }

  // 2) 증분: 이미 분석된 media_post_id 집합. reanalyze 면 무시(전체 재분석).
  const idByExternal = new Map<string, string>(); // external_media_id → media_post.id
  for (const r of rows) idByExternal.set(r.external_media_id, r.id);

  let alreadyDone = new Set<string>();
  if (!opts.reanalyze) {
    const { data: existing, error: exError } = await admin
      .from(ANALYSIS)
      .select("media_post_id")
      .in("media_post_id", [...idByExternal.values()]);
    if (exError) throw exError;
    alreadyDone = new Set(
      (existing ?? []).map((e) => e.media_post_id as string)
    );
  }

  const targets = rows.filter((r) => !alreadyDone.has(r.id));
  if (targets.length === 0) {
    return {
      analyzed: 0,
      skipped: rows.length,
      model: null,
      inputTokens: null,
      outputTokens: null,
    };
  }

  // 3) AI 분석.
  const posts: PostForAnalysis[] = targets.map((r) => {
    const m = latestMetric(r.metrics);
    return {
      externalMediaId: r.external_media_id,
      caption: r.caption,
      mediaType: r.media_type,
      likeCount: m?.like_count ?? null,
      commentsCount: m?.comments_count ?? null,
      postedAt: r.posted_at,
    };
  });

  const { results, model, usage } = await analyzeContent(posts);

  // 4) 적재 — 멱등: 대상 media_post 의 기존 분석을 지우고 새로 삽입(재분석 중복 방지).
  const rowsToInsert = results
    .map((a: ContentAnalysis) => {
      const mediaPostId = idByExternal.get(a.externalMediaId);
      if (!mediaPostId) return null;
      return {
        media_post_id: mediaPostId,
        model,
        topic: a.topic || null,
        appeal_points: a.appealPoints,
        format: a.format || null,
        tone: a.tone || null,
        summary: a.summary || null,
        keywords: a.keywords,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rowsToInsert.length > 0) {
    const targetPostIds = rowsToInsert.map((r) => r.media_post_id);
    const { error: delError } = await admin
      .from(ANALYSIS)
      .delete()
      .in("media_post_id", targetPostIds);
    if (delError) throw delError;

    const { error: insError } = await admin.from(ANALYSIS).insert(rowsToInsert);
    if (insError) throw insError;
  }

  return {
    analyzed: rowsToInsert.length,
    skipped: rows.length - targets.length,
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };
}
