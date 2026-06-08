import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type BusinessDiscoveryMedia,
  fetchBusinessDiscovery,
  fetchMediaInsights,
  fetchOwnedProfile,
} from "@/lib/meta/client";

/**
 * Business Discovery 수집기 (Phase 1) — **서버 전용**.
 * 외부 비즈니스/크리에이터 계정의 공개지표를 가져와 raw 테이블에 적재한다:
 *   account_snapshots(시계열) / media_posts(게시물) / post_metrics(지표, source=official).
 * 노출·도달은 외부 계정에서 확보 불가 → 항상 null 로 둔다(D-004).
 *
 * 적재는 RLS 우회가 필요(수집 잡 권한)하므로 service-role(admin) 클라이언트를 받는다.
 * 호출부에서 대상 tracked_account 의 소유권을 먼저 검증한 뒤 넘겨야 한다.
 */

const SNAPSHOTS = "analyze_insta_account_snapshots";
const MEDIA = "analyze_insta_media_posts";
const METRICS = "analyze_insta_post_metrics";
const ACCOUNTS = "analyze_insta_tracked_accounts";

/** Meta media_type/media_product_type → 우리 enum(analyze_insta_media_kind). */
function mapMediaKind(
  mediaType: string | null,
  productType: string | null
): "image" | "video" | "carousel" | "reel" | null {
  if (productType === "REELS") return "reel";
  switch (mediaType) {
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "CAROUSEL_ALBUM":
      return "carousel";
    default:
      return null;
  }
}

export type CollectResult = {
  username: string;
  followersCount: number | null;
  mediaCount: number | null;
  collectedPosts: number;
  capturedAt: string;
  /** 내 계정 수집에서 인사이트(노출·도달)가 실제로 채워진 게시물 수. 외부는 0. */
  insightsCollected?: number;
};

type TrackedAccountRef = { id: string; username: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function collectTrackedAccount(
  admin: SupabaseClient,
  account: TrackedAccountRef,
  token: string,
  igUserId: string
): Promise<CollectResult> {
  const profile = await fetchBusinessDiscovery(token, igUserId, account.username);
  const capturedAt = new Date().toISOString();

  // 1) 대상의 ig_id 보강(처음 수집 시).
  await admin
    .from(ACCOUNTS)
    .update({ ig_id: profile.igId })
    .eq("id", account.id);

  // 2) 계정 스냅샷(시계열) 적재.
  const { error: snapError } = await admin.from(SNAPSHOTS).insert({
    tracked_account_id: account.id,
    captured_at: capturedAt,
    followers_count: profile.followersCount,
    media_count: profile.mediaCount,
    biography: profile.biography,
  });
  if (snapError) throw snapError;

  // 3) 게시물 upsert(중복 external_media_id 갱신) → id 회수 → 지표 적재.
  let collectedPosts = 0;
  if (profile.media.length > 0) {
    const mediaRows = profile.media.map((m: BusinessDiscoveryMedia) => ({
      tracked_account_id: account.id,
      external_media_id: m.id,
      permalink: m.permalink,
      caption: m.caption,
      media_type: mapMediaKind(m.media_type, m.media_product_type),
      posted_at: m.timestamp,
      media_url: m.media_url,
      raw: m as unknown as Record<string, unknown>,
    }));

    const { data: upserted, error: mediaError } = await admin
      .from(MEDIA)
      .upsert(mediaRows, {
        onConflict: "tracked_account_id,external_media_id",
      })
      .select("id, external_media_id");
    if (mediaError) throw mediaError;

    // external_media_id → media_post.id 매핑으로 지표 행 구성.
    const idByExternal = new Map<string, string>();
    for (const row of upserted ?? []) {
      idByExternal.set(row.external_media_id as string, row.id as string);
    }

    const metricRows = profile.media
      .map((m) => {
        const mediaPostId = idByExternal.get(m.id);
        if (!mediaPostId) return null;
        return {
          media_post_id: mediaPostId,
          captured_at: capturedAt,
          source: "official" as const,
          like_count: m.like_count,
          comments_count: m.comments_count,
          // 외부 계정 — 노출/도달/저장/조회 등은 확보 불가(null).
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (metricRows.length > 0) {
      const { error: metricError } = await admin.from(METRICS).insert(metricRows);
      if (metricError) throw metricError;
    }
    collectedPosts = profile.media.length;
  }

  return {
    username: profile.username ?? account.username,
    followersCount: profile.followersCount,
    mediaCount: profile.mediaCount,
    collectedPosts,
    capturedAt,
  };
}

/** 게시물별 인사이트 호출 사이 페이싱(ms). 버스트 레이트리밋 회피(D-023). */
const OWNED_INSIGHT_DELAY_MS = 250;

/**
 * 내 계정(토큰 주인 본인) 완전분석 수집 (Phase 3, D-023) — **서버 전용**.
 * fetchOwnedProfile 로 프로필+게시물(+follows_count)을 받고, 게시물마다
 * fetchMediaInsights 로 노출·도달·저장·조회를 채워 post_metrics 에 적재한다.
 * igUserId 는 **반드시 토큰 주인 본인(cred.ig_user_id)** 이어야 한다(외부 계정에 인사이트 호출 금지).
 */
export async function collectOwnedAccount(
  admin: SupabaseClient,
  account: TrackedAccountRef,
  token: string,
  igUserId: string
): Promise<CollectResult> {
  const profile = await fetchOwnedProfile(token, igUserId);
  const capturedAt = new Date().toISOString();

  // 1) ig_id 보강(본인 ig_user_id).
  await admin.from(ACCOUNTS).update({ ig_id: profile.igId }).eq("id", account.id);

  // 2) 스냅샷 — 내 계정은 follows_count 까지 적재.
  const { error: snapError } = await admin.from(SNAPSHOTS).insert({
    tracked_account_id: account.id,
    captured_at: capturedAt,
    followers_count: profile.followersCount,
    follows_count: profile.followsCount,
    media_count: profile.mediaCount,
    biography: profile.biography,
  });
  if (snapError) throw snapError;

  let collectedPosts = 0;
  let insightsCollected = 0;
  if (profile.media.length > 0) {
    const mediaRows = profile.media.map((m: BusinessDiscoveryMedia) => ({
      tracked_account_id: account.id,
      external_media_id: m.id,
      permalink: m.permalink,
      caption: m.caption,
      media_type: mapMediaKind(m.media_type, m.media_product_type),
      posted_at: m.timestamp,
      media_url: m.media_url,
      raw: m as unknown as Record<string, unknown>,
    }));

    const { data: upserted, error: mediaError } = await admin
      .from(MEDIA)
      .upsert(mediaRows, { onConflict: "tracked_account_id,external_media_id" })
      .select("id, external_media_id");
    if (mediaError) throw mediaError;

    const idByExternal = new Map<string, string>();
    for (const row of upserted ?? []) {
      idByExternal.set(row.external_media_id as string, row.id as string);
    }

    // 3) 게시물별 인사이트(노출·도달·저장·조회) — 페이싱 적용.
    const metricRows: Array<Record<string, unknown>> = [];
    for (const m of profile.media) {
      const mediaPostId = idByExternal.get(m.id);
      if (!mediaPostId) continue;
      const kind = mapMediaKind(m.media_type, m.media_product_type);
      const ins = await fetchMediaInsights(token, m.id, kind);
      if (
        ins.reach != null ||
        ins.impressions != null ||
        ins.saved != null ||
        ins.videoViews != null ||
        ins.plays != null
      ) {
        insightsCollected += 1;
      }
      metricRows.push({
        media_post_id: mediaPostId,
        captured_at: capturedAt,
        source: "official" as const,
        like_count: m.like_count,
        comments_count: m.comments_count,
        reach: ins.reach,
        impressions: ins.impressions,
        saved: ins.saved,
        video_views: ins.videoViews,
        plays: ins.plays,
      });
      await sleep(OWNED_INSIGHT_DELAY_MS);
    }

    if (metricRows.length > 0) {
      const { error: metricError } = await admin.from(METRICS).insert(metricRows);
      if (metricError) throw metricError;
    }
    collectedPosts = profile.media.length;
  }

  return {
    username: profile.username ?? account.username,
    followersCount: profile.followersCount,
    mediaCount: profile.mediaCount,
    collectedPosts,
    capturedAt,
    insightsCollected,
  };
}
