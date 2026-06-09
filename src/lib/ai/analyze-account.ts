import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type ContentAnalysis,
  type PostForAnalysis,
  analyzeContent,
} from "./content-analysis";
import { toPersonaCategory } from "./personas";

/**
 * 계정 콘텐츠 분석 오케스트레이터 (Phase 2) — **서버 전용**.
 * 수집된 media_posts(+최신 지표)를 AI 로 분석해 content_analysis(가공)에 적재한다.
 * 기본은 **증분**(아직 분석 안 된 게시물만). reanalyze=true 면 대상 전체 재분석.
 *
 * 적재는 RLS 우회(가공 잡 권한)가 필요 → service-role(admin) 클라이언트를 받는다.
 * 호출부에서 tracked_account 소유권을 먼저 검증한 뒤 넘겨야 한다(collect.ts 와 동일 사상).
 */

const ACCOUNTS = "analyze_insta_tracked_accounts";
const MEDIA = "analyze_insta_media_posts";
const METRICS = "analyze_insta_post_metrics";
const ANALYSIS = "analyze_insta_content_analysis";

/** 한 계정에서 분석 대상으로 삼을 최신 게시물 상한(비용·시간 보호). */
const MAX_POSTS = 30;

export type AnalyzeAccountResult = {
  analyzed: number;
  skipped: number;
  /** 이번 호출에서 처리하지 못하고 남은 미분석 게시물 수(클라가 0 될 때까지 반복). D-023. */
  remaining: number;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  /** 비전으로 이미지가 실제 분석된 게시물 수. D-022. */
  imagesAnalyzed: number;
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
  media_url: string | null;
  raw: Record<string, unknown> | null;
  metrics: MetricRow[] | null;
};

function latestMetric(metrics: MetricRow[] | null): MetricRow | null {
  if (!metrics || metrics.length === 0) return null;
  return [...metrics].sort(
    (a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at)
  )[0];
}

/**
 * 비전 분석에 쓸 이미지 URL. (D-022)
 * image/carousel = media_url(이미지). video/reel = raw.thumbnail_url(있을 때만 —
 * media_url 은 비디오 파일이라 인라인 비전 불가). 없으면 null → 캡션만 분석.
 */
function imageUrlForRow(row: MediaRow): string | null {
  if (row.media_type === "video" || row.media_type === "reel") {
    const thumb = row.raw?.thumbnail_url;
    return typeof thumb === "string" && thumb ? thumb : null;
  }
  return row.media_url ?? null;
}

export async function analyzeTrackedAccount(
  admin: SupabaseClient,
  accountId: string,
  opts: { reanalyze?: boolean; vision?: boolean; limit?: number } = {}
): Promise<AnalyzeAccountResult> {
  // 0) 계정의 페르소나 카테고리 — 카테고리별 분석 프롬프트 선택(D-028 후속).
  const { data: accountRow } = await admin
    .from(ACCOUNTS)
    .select("persona_category")
    .eq("id", accountId)
    .maybeSingle();
  const category = toPersonaCategory(accountRow?.persona_category);

  // 1) 대상 게시물 + 최신 지표(최신순, 상한 적용).
  const { data: mediaRows, error: mediaError } = await admin
    .from(MEDIA)
    .select(
      `id, external_media_id, caption, media_type, posted_at, media_url, raw,
       metrics:${METRICS}(captured_at, like_count, comments_count)`
    )
    .eq("tracked_account_id", accountId)
    .order("posted_at", { ascending: false })
    .limit(MAX_POSTS);
  if (mediaError) throw mediaError;

  const rows = (mediaRows ?? []) as MediaRow[];
  if (rows.length === 0) {
    return {
      analyzed: 0,
      skipped: 0,
      remaining: 0,
      model: null,
      inputTokens: null,
      outputTokens: null,
      imagesAnalyzed: 0,
    };
  }

  const idByExternal = new Map<string, string>(); // external_media_id → media_post.id
  for (const r of rows) idByExternal.set(r.external_media_id, r.id);

  // 2) reanalyze=true: 이 계정의 기존 분석을 **한 번 전체 리셋**한 뒤 증분처럼 진행한다.
  //    (반복 호출 시 첫 호출만 reanalyze=true 로 와서 1회 리셋 → 이후 증분으로 남은 청크 처리.)
  if (opts.reanalyze) {
    const { error: resetError } = await admin
      .from(ANALYSIS)
      .delete()
      .in("media_post_id", [...idByExternal.values()]);
    if (resetError) throw resetError;
  }

  // 3) 증분: 이미 분석된 media_post_id 집합(리셋 직후면 비어 있음).
  const { data: existing, error: exError } = await admin
    .from(ANALYSIS)
    .select("media_post_id")
    .in("media_post_id", [...idByExternal.values()]);
  if (exError) throw exError;
  const alreadyDone = new Set(
    (existing ?? []).map((e) => e.media_post_id as string)
  );

  // 미분석 전체 → 이번 호출은 limit 개만 처리(나머지는 remaining 으로 알려 클라가 반복).
  const allTargets = rows.filter((r) => !alreadyDone.has(r.id));
  const alreadyAnalyzed = rows.length - allTargets.length;
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? opts.limit
      : allTargets.length;
  const targets = allTargets.slice(0, limit);
  const remaining = allTargets.length - targets.length;

  if (targets.length === 0) {
    return {
      analyzed: 0,
      skipped: alreadyAnalyzed,
      remaining: 0,
      model: null,
      inputTokens: null,
      outputTokens: null,
      imagesAnalyzed: 0,
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
      imageUrl: imageUrlForRow(r),
    };
  });

  const { results, model, usage, imagesAnalyzed } = await analyzeContent(posts, {
    vision: opts.vision,
    category,
  });

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
        visual_notes: a.visualNotes || null,
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
    skipped: alreadyAnalyzed,
    remaining,
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    imagesAnalyzed,
  };
}
