import "server-only";

import { createHmac } from "node:crypto";

import { getMetaAppCreds, getMetaGraphVersion } from "@/lib/env";

/**
 * Meta(Instagram) Graph API 최소 클라이언트 — **서버 전용**.
 * 참조: docs/05_META_API.md, /meta-api 스킬.
 * 원칙: 토큰은 인자로만 받고 로그/반환에 평문 노출 금지. rate limit 헤더 모니터링.
 */

const GRAPH_BASE = "https://graph.facebook.com";

/** 사용자에게 그대로 보여줄 수 있는 메시지를 담은 에러. */
export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly raw?: unknown
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

/** appsecret_proof — 앱 시크릿이 있을 때만 서명. (탈취 토큰 오용 방어) */
function appSecretProof(token: string): string | null {
  const creds = getMetaAppCreds();
  if (!creds) return null;
  return createHmac("sha256", creds.appSecret).update(token).digest("hex");
}

/**
 * rate limit 헤더 모니터링. 사용률이 높으면 경고 로그.
 * 데이터 수집 잡은 이 신호로 배치를 분산/지연해야 한다(docs/05 §3).
 */
function monitorRateLimit(res: Response, path: string) {
  const buc = res.headers.get("x-business-use-case-usage");
  const app = res.headers.get("x-app-usage");
  try {
    if (buc) {
      const parsed = JSON.parse(buc) as Record<
        string,
        Array<{ call_count?: number; total_time?: number }>
      >;
      for (const usages of Object.values(parsed)) {
        for (const u of usages) {
          if ((u.call_count ?? 0) >= 80 || (u.total_time ?? 0) >= 80) {
            console.warn(
              `[meta] BUC 사용률 높음 (${path}): call_count=${u.call_count} total_time=${u.total_time}`
            );
          }
        }
      }
    }
    if (app) {
      const u = JSON.parse(app) as { call_count?: number };
      if ((u.call_count ?? 0) >= 80) {
        console.warn(`[meta] App 사용률 높음 (${path}): ${app}`);
      }
    }
  } catch {
    // 헤더 파싱 실패는 무시 (모니터링 보조 목적).
  }
}

type GraphParams = Record<string, string>;

async function graphGet<T>(
  path: string,
  token: string,
  params: GraphParams = {}
): Promise<T> {
  const version = getMetaGraphVersion();
  const url = new URL(`${GRAPH_BASE}/${version}/${path}`);
  url.searchParams.set("access_token", token);
  const proof = appSecretProof(token);
  if (proof) url.searchParams.set("appsecret_proof", proof);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (err) {
    throw new MetaApiError(
      "Meta API 연결에 실패했습니다. 네트워크를 확인하세요.",
      502,
      err
    );
  }

  monitorRateLimit(res, path);

  const body = (await res.json().catch(() => null)) as
    | { error?: { message?: string; code?: number; type?: string } }
    | (T & { error?: undefined })
    | null;

  if (!res.ok || (body && "error" in body && body.error)) {
    const apiErr = body && "error" in body ? body.error : undefined;
    const msg = apiErr?.message ?? `Meta API 오류 (HTTP ${res.status})`;
    // 토큰 만료/무효는 가장 흔한 케이스 — 안내 메시지 보강.
    const hint =
      apiErr?.code === 190
        ? " (토큰이 만료되었거나 유효하지 않습니다. 새 토큰을 발급해 주세요.)"
        : "";
    throw new MetaApiError(`${msg}${hint}`, res.status === 200 ? 400 : res.status, apiErr);
  }

  return body as T;
}

export type ResolvedInstagramUser = {
  igUserId: string;
  username: string | null;
  pageName: string | null;
  /** IG 비즈니스 계정이 연결된 페이지가 여러 개면 그 수 (사용자 인지용). */
  candidateCount: number;
};

type MeAccountsResponse = {
  data?: Array<{
    id: string;
    name?: string;
    instagram_business_account?: { id: string; username?: string; name?: string };
  }>;
};

/**
 * 사용자 토큰으로 연결된 IG 비즈니스/크리에이터 계정의 ig_user_id 를 추출.
 * 흐름: GET /me/accounts → instagram_business_account 가 있는 첫 페이지 선택.
 * (docs/05 §1) 이것이 모든 Business Discovery 호출의 열쇠.
 */
export async function resolveInstagramUser(
  token: string
): Promise<ResolvedInstagramUser> {
  const res = await graphGet<MeAccountsResponse>("me/accounts", token, {
    fields: "name,instagram_business_account{id,username,name}",
  });

  const pages = res.data ?? [];
  const linked = pages.filter((p) => p.instagram_business_account?.id);

  if (linked.length === 0) {
    throw new MetaApiError(
      "이 토큰에 연결된 인스타그램 비즈니스/크리에이터 계정을 찾지 못했습니다. " +
        "IG 계정이 비즈니스/크리에이터로 전환되고 Facebook 페이지에 연결됐는지, " +
        "토큰 스코프(instagram_basic, pages_show_list)가 포함됐는지 확인하세요.",
      400
    );
  }

  const chosen = linked[0];
  const iba = chosen.instagram_business_account!;
  return {
    igUserId: iba.id,
    username: iba.username ?? null,
    pageName: chosen.name ?? null,
    candidateCount: linked.length,
  };
}

// =====================================================================
// Business Discovery — 외부 비즈니스/크리에이터 계정 공개지표 (Phase 1)
// 참조: docs/05_META_API.md, /meta-api 스킬.
// 노출/도달/댓글내용은 제공되지 않는다(외부 계정 한계). 좋아요·댓글수·캡션만.
// =====================================================================

export type BusinessDiscoveryMedia = {
  id: string;
  caption: string | null;
  like_count: number | null;
  comments_count: number | null;
  media_type: string | null;
  media_product_type: string | null;
  media_url: string | null;
  permalink: string | null;
  timestamp: string | null;
};

export type BusinessDiscoveryProfile = {
  igId: string;
  username: string | null;
  name: string | null;
  biography: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  profilePictureUrl: string | null;
  media: BusinessDiscoveryMedia[];
};

type BusinessDiscoveryResponse = {
  business_discovery?: {
    id?: string;
    username?: string;
    name?: string;
    biography?: string;
    followers_count?: number;
    media_count?: number;
    profile_picture_url?: string;
    media?: {
      data?: Array<{
        id: string;
        caption?: string;
        like_count?: number;
        comments_count?: number;
        media_type?: string;
        media_product_type?: string;
        media_url?: string;
        permalink?: string;
        timestamp?: string;
      }>;
    };
  };
};

/**
 * 위임 토큰의 ig_user_id 로 외부 대상(username)의 공개지표를 조회.
 * 대상이 비즈니스/크리에이터 계정이 아니거나 존재하지 않으면 MetaApiError.
 * @param mediaLimit 가져올 최근 게시물 수 (기본 25).
 */
export async function fetchBusinessDiscovery(
  token: string,
  igUserId: string,
  targetUsername: string,
  mediaLimit = 25
): Promise<BusinessDiscoveryProfile> {
  const username = targetUsername.trim().replace(/^@/, "");
  if (!username) {
    throw new MetaApiError("분석할 계정 username 을 입력하세요.", 400);
  }

  const mediaFields =
    "id,caption,like_count,comments_count,media_type," +
    "media_product_type,media_url,permalink,timestamp";
  const fields =
    `business_discovery.username(${username}){` +
    `followers_count,media_count,biography,name,username,profile_picture_url,` +
    `media.limit(${mediaLimit}){${mediaFields}}}`;

  let res: BusinessDiscoveryResponse;
  try {
    res = await graphGet<BusinessDiscoveryResponse>(igUserId, token, { fields });
  } catch (err) {
    // 대상이 개인계정/미존재일 때 Meta 가 주는 모호한 메시지를 보강.
    if (err instanceof MetaApiError) {
      const lower = err.message.toLowerCase();
      if (
        lower.includes("cannot be found") ||
        lower.includes("does not exist") ||
        lower.includes("business discovery")
      ) {
        throw new MetaApiError(
          `@${username} 의 공개지표를 가져올 수 없습니다. ` +
            "대상이 비즈니스/크리에이터 계정이어야 하며(개인계정 불가), " +
            "존재하는 username 인지 확인하세요.",
          err.status,
          err.raw
        );
      }
    }
    throw err;
  }

  const bd = res.business_discovery;
  if (!bd?.id) {
    throw new MetaApiError(
      `@${username} 의 공개지표 응답이 비어 있습니다. 비즈니스/크리에이터 계정인지 확인하세요.`,
      400
    );
  }

  return {
    igId: bd.id,
    username: bd.username ?? username,
    name: bd.name ?? null,
    biography: bd.biography ?? null,
    followersCount: bd.followers_count ?? null,
    mediaCount: bd.media_count ?? null,
    profilePictureUrl: bd.profile_picture_url ?? null,
    media: (bd.media?.data ?? []).map((m) => ({
      id: m.id,
      caption: m.caption ?? null,
      like_count: m.like_count ?? null,
      comments_count: m.comments_count ?? null,
      media_type: m.media_type ?? null,
      media_product_type: m.media_product_type ?? null,
      media_url: m.media_url ?? null,
      permalink: m.permalink ?? null,
      timestamp: m.timestamp ?? null,
    })),
  };
}

// =====================================================================
// 해시태그 검색 (Phase 1 보조) — ⚠️ 토큰당 7일 30개 고유 태그 하드 쿼터.
// 작성자 정보·조회수 없음. 호출부에서 쿼터를 사전 enforce 해야 한다.
// =====================================================================

export type HashtagMedia = {
  id: string;
  caption: string | null;
  like_count: number | null;
  comments_count: number | null;
  media_type: string | null;
  permalink: string | null;
  timestamp: string | null;
};

type HashtagSearchResponse = { data?: Array<{ id: string }> };
type HashtagMediaResponse = {
  data?: Array<{
    id: string;
    caption?: string;
    like_count?: number;
    comments_count?: number;
    media_type?: string;
    permalink?: string;
    timestamp?: string;
  }>;
};

/** 키워드 → hashtag_id. ⚠️ 이 호출도 7일/30개 쿼터를 소비한다. */
export async function searchHashtag(
  token: string,
  igUserId: string,
  keyword: string
): Promise<string> {
  const q = keyword.trim().replace(/^#/, "");
  if (!q) throw new MetaApiError("해시태그를 입력하세요.", 400);

  const res = await graphGet<HashtagSearchResponse>("ig_hashtag_search", token, {
    user_id: igUserId,
    q,
  });
  const id = res.data?.[0]?.id;
  if (!id) {
    throw new MetaApiError(`#${q} 에 해당하는 해시태그를 찾지 못했습니다.`, 404);
  }
  return id;
}

/**
 * hashtag_id 의 인기/최근 게시물. type='top'(인기) 기본.
 * 반환에 작성자·조회수 없음(Meta 미제공).
 */
export async function fetchHashtagMedia(
  token: string,
  igUserId: string,
  hashtagId: string,
  type: "top" | "recent" = "top",
  limit = 25
): Promise<HashtagMedia[]> {
  const edge = type === "top" ? "top_media" : "recent_media";
  const res = await graphGet<HashtagMediaResponse>(
    `${hashtagId}/${edge}`,
    token,
    {
      user_id: igUserId,
      fields: "id,caption,like_count,comments_count,media_type,permalink,timestamp",
      limit: String(limit),
    }
  );
  return (res.data ?? []).map((m) => ({
    id: m.id,
    caption: m.caption ?? null,
    like_count: m.like_count ?? null,
    comments_count: m.comments_count ?? null,
    media_type: m.media_type ?? null,
    permalink: m.permalink ?? null,
    timestamp: m.timestamp ?? null,
  }));
}

export type LongLivedToken = {
  token: string;
  /** 만료 시각(ISO). 알 수 없으면 null. */
  expiresAt: string | null;
};

/**
 * 단기 → 장기(~60일) 토큰 교환. 앱 시크릿이 있을 때만 동작.
 * 미설정이면 원본 토큰을 만료 미상으로 그대로 반환(graceful).
 */
export async function exchangeLongLivedToken(
  token: string
): Promise<LongLivedToken> {
  const creds = getMetaAppCreds();
  if (!creds) return { token, expiresAt: null };

  const version = getMetaGraphVersion();
  const url = new URL(`${GRAPH_BASE}/${version}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", creds.appId);
  url.searchParams.set("client_secret", creds.appSecret);
  url.searchParams.set("fb_exchange_token", token);

  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  } | null;

  if (!res.ok || !body?.access_token) {
    // 교환 실패해도 치명적이지 않음 — 원본 토큰 유지하고 경고만.
    console.warn(
      `[meta] 장기 토큰 교환 실패: ${body?.error?.message ?? res.status}`
    );
    return { token, expiresAt: null };
  }

  const expiresAt = body.expires_in
    ? new Date(Date.now() + body.expires_in * 1000).toISOString()
    : null;
  return { token: body.access_token, expiresAt };
}
