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
