import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type HashtagMedia,
  MetaApiError,
  fetchHashtagMedia,
  searchHashtag,
} from "@/lib/meta/client";

/**
 * 해시태그 검색 + 쿼터 관리 (Phase 1 보조) — **서버 전용**.
 * ⚠️ Meta 하드 쿼터: **토큰(계정)당 7일 롤링 30개 고유 해시태그.**
 * 새 태그를 조회하기 전에 최근 7일 고유 태그 수를 세어 30개 한도를 사전 차단한다.
 * 이미 7일 내 조회한 태그의 재조회는 새 쿼터를 소비하지 않는다(같은 고유 태그).
 */

const JOBS = "analyze_insta_hashtag_jobs";
const RESULTS = "analyze_insta_hashtag_results";

export const HASHTAG_QUOTA_LIMIT = 30;
const WINDOW_DAYS = 7;

function mapMediaKind(
  mediaType: string | null
): "image" | "video" | "carousel" | "reel" | null {
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

function normalize(keyword: string): string {
  return keyword.trim().replace(/^#/, "").toLowerCase();
}

export type QuotaStatus = {
  used: number; // 최근 7일 고유 태그 수
  limit: number; // 30
  remaining: number;
  /** 최근 7일 내 조회한 고유 해시태그 목록. */
  recentHashtags: string[];
};

/** 최근 7일 롤링 쿼터 상태 조회. */
export async function getHashtagQuota(
  db: SupabaseClient,
  userId: string
): Promise<QuotaStatus> {
  const cutoff = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await db
    .from(JOBS)
    .select("hashtag, requested_at")
    .eq("user_id", userId)
    .gte("requested_at", cutoff);
  if (error) throw error;

  const unique = new Set<string>();
  for (const row of data ?? []) {
    unique.add(normalize(row.hashtag as string));
  }
  const used = unique.size;
  return {
    used,
    limit: HASHTAG_QUOTA_LIMIT,
    remaining: Math.max(0, HASHTAG_QUOTA_LIMIT - used),
    recentHashtags: [...unique],
  };
}

export type HashtagRunResult = {
  hashtag: string;
  hashtagId: string;
  results: HashtagMedia[];
  quota: QuotaStatus;
  /** 이미 7일 내 조회했던 태그라 새 쿼터를 소비하지 않았는지. */
  reusedQuota: boolean;
};

/**
 * 해시태그 1건 조회 + 적재. 쿼터 초과 시 MetaApiError(429).
 * 적재는 service-role(admin) 필요 — hashtag_results 는 부모 통해서만 SELECT 허용.
 */
export async function runHashtagSearch(
  admin: SupabaseClient,
  params: {
    userId: string;
    credentialId: string | null;
    token: string;
    igUserId: string;
    keyword: string;
    type?: "top" | "recent";
  }
): Promise<HashtagRunResult> {
  const hashtag = normalize(params.keyword);
  if (!hashtag) throw new MetaApiError("해시태그를 입력하세요.", 400);

  // 1) 쿼터 사전 체크(롤링 7일 고유 30개).
  const quota = await getHashtagQuota(admin, params.userId);
  const alreadyQueried = quota.recentHashtags.includes(hashtag);
  if (!alreadyQueried && quota.remaining <= 0) {
    throw new MetaApiError(
      `해시태그 쿼터 초과: 최근 7일 동안 ${quota.used}/${HASHTAG_QUOTA_LIMIT}개 고유 태그를 사용했습니다. ` +
        "가장 오래된 조회가 7일을 지나면 한도가 회복됩니다.",
      429
    );
  }

  // 2) 검색 + 미디어 조회.
  const hashtagId = await searchHashtag(params.token, params.igUserId, hashtag);
  const results = await fetchHashtagMedia(
    params.token,
    params.igUserId,
    hashtagId,
    params.type ?? "top"
  );

  // 3) job 적재.
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data: job, error: jobError } = await admin
    .from(JOBS)
    .insert({
      user_id: params.userId,
      credential_id: params.credentialId,
      hashtag,
      hashtag_id: hashtagId,
      quota_week_start: today,
      status: "done",
    })
    .select("id")
    .single();
  if (jobError) throw jobError;

  // 4) 결과 적재.
  if (results.length > 0) {
    const rows = results.map((m) => ({
      hashtag_job_id: job.id as string,
      external_media_id: m.id,
      caption: m.caption,
      like_count: m.like_count,
      comments_count: m.comments_count,
      media_type: mapMediaKind(m.media_type),
      permalink: m.permalink,
      raw: m as unknown as Record<string, unknown>,
    }));
    const { error: resError } = await admin.from(RESULTS).insert(rows);
    if (resError) throw resError;
  }

  // 5) 갱신된 쿼터 반환.
  const quotaAfter = await getHashtagQuota(admin, params.userId);
  return {
    hashtag,
    hashtagId,
    results,
    quota: quotaAfter,
    reusedQuota: alreadyQueried,
  };
}
