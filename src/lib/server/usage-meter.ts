import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 사용량 미터 (Phase 3.5 · D-024 / 일일 한도 전환 D-032 후속) — "누가 얼마나 쓰나" 가로 레이어.
 *
 * 두 개의 일일 미터(둘 다 "하루 N회", 테스트 기간 정책):
 *   ① collect — 수집·지표 묶음 (Meta·무료/오너 쿼터 보호). 실질 발동 = /collect.
 *               지표(/metrics) 조회는 무계측 — 새 데이터 받을 때(수집)만 소비.
 *   ② llm     — 분석·비교 묶음 (LLM·비용). /analyze + /compare 공용 풀.
 *
 * 리셋 = 매일 **한국시간(KST) 0시** 일괄 초기화(슬라이딩 아님 — 오늘 쓴 횟수만 센다).
 * 모든 함수는 service-role(admin) 클라이언트 필요 — usage_events 쓰기 정책 없음,
 * api_credentials 는 RLS 정책 자체가 없어 admin 만 접근 가능.
 */

/** 미터 종류 — DB enum `analyze_insta_usage_action` 과 일치. */
export type UsageAction = "collect" | "llm";

/** 티어. trial=개인 토큰 미등록(오너 토큰 체험) / personal=본인 토큰 등록. */
export type UsageTier = "trial" | "personal";

export const DAY_MS = 24 * 60 * 60 * 1000;
/** KST = UTC+9 (서머타임 없음). */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 오늘(KST) 0시의 epoch(ms) — 일일 윈도우 시작점. */
export function kstDayStartMs(now: number = Date.now()): number {
  return Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS;
}

/**
 * 액션×티어 **하루** 한도(KST 0시 리셋). `null` = 무제한.
 *  - collect: 체험 10 / 개인 무제한 (개인은 본인 Meta 쿼터를 쓰므로 오너 보호 불필요).
 *  - llm:     두 티어 모두 10 공용 (LLM 실비용은 토큰과 무관하게 운영자 부담 → 안 풀림).
 */
export const USAGE_LIMITS: Record<UsageAction, Record<UsageTier, number | null>> = {
  collect: { trial: 10, personal: null },
  llm: { trial: 10, personal: 10 },
};

/**
 * 외부 계정(경쟁사·인플루언서) 등록 개수 한도 (D-024).
 *  - 체험(오너 토큰): 3개 — 오너 쿼터 보호.
 *  - 개인 토큰: 10개 — 본인 쿼터를 쓰므로 여유.
 * 내 계정(owned)은 이 한도와 무관(토큰당 1개, 본인 토큰 전용).
 */
export const ACCOUNT_LIMITS: Record<UsageTier, number> = {
  trial: 3,
  personal: 10,
};

const USAGE = "analyze_insta_usage_events";
const CREDENTIALS = "analyze_insta_api_credentials";
const ACCOUNTS = "analyze_insta_tracked_accounts";
const CHANNEL = "instagram";

/**
 * 티어 판별 = 본인 Meta 토큰(api_credentials) 등록 여부.
 * 등록돼 있으면 personal, 없으면 trial(오너 토큰 체험).
 */
export async function resolveTier(
  admin: SupabaseClient,
  userId: string
): Promise<UsageTier> {
  const { data, error } = await admin
    .from(CREDENTIALS)
    .select("id")
    .eq("user_id", userId)
    .eq("channel", CHANNEL)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? "personal" : "trial";
}

export type MeterStatus = {
  action: UsageAction;
  tier: UsageTier;
  /** 하루 한도. null = 무제한. */
  limit: number | null;
  /** 오늘(KST 0시 이후) 사용 횟수. */
  used: number;
  /** 남은 횟수. null = 무제한. */
  remaining: number | null;
  /** 막혔을 때 초기화 시각(다음 KST 0시, ISO). 여유 있거나 무제한이면 null. */
  resetAt: string | null;
  /** 지금 1회 쓸 수 있는지. */
  allowed: boolean;
};

/**
 * 현재 미터 상태 계산 — **소비하지 않음**(읽기 전용). 게이트 판정·UI 둘 다 사용.
 * tier 를 미리 알면 넘겨서 중복 조회를 아낀다.
 */
export async function getMeterStatus(
  admin: SupabaseClient,
  userId: string,
  action: UsageAction,
  tier?: UsageTier
): Promise<MeterStatus> {
  const resolvedTier = tier ?? (await resolveTier(admin, userId));
  const limit = USAGE_LIMITS[action][resolvedTier];

  // 무제한: 조회 없이 즉시 통과.
  if (limit === null) {
    return {
      action,
      tier: resolvedTier,
      limit: null,
      used: 0,
      remaining: null,
      resetAt: null,
      allowed: true,
    };
  }

  // 오늘(KST 0시 이후) 사용분만 집계 — 막히면 다음 KST 0시에 일괄 초기화.
  const dayStart = kstDayStartMs();
  const { count, error } = await admin
    .from(USAGE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", new Date(dayStart).toISOString());
  if (error) throw error;

  const used = count ?? 0;
  const remaining = Math.max(0, limit - used);
  const allowed = remaining > 0;
  const resetAt = allowed ? null : new Date(dayStart + DAY_MS).toISOString();

  return { action, tier: resolvedTier, limit, used, remaining, resetAt, allowed };
}

/** 사용 1건 기록(append). **게이트 통과 + 실제 작업 성공 후** 호출한다. */
export async function recordUsage(
  admin: SupabaseClient,
  userId: string,
  action: UsageAction
): Promise<void> {
  const { error } = await admin
    .from(USAGE)
    .insert({ user_id: userId, action });
  if (error) throw error;
}

const ACTION_LABEL: Record<UsageAction, string> = {
  collect: "수집",
  llm: "분석·비교",
};

/**
 * 막힘 안내 문구(서버 기본). UI 는 meter(resetAt)로 자체 카운트다운을 그릴 수도 있다.
 * 체험 유저의 수집 막힘에는 개인 토큰 전환 유도를 덧붙인다(D-024).
 */
export function meterBlockedMessage(status: MeterStatus): string {
  const label = ACTION_LABEL[status.action];
  const base = `오늘 ${label} 횟수를 모두 썼어요 (하루 ${status.limit}회).`;
  const tail = status.resetAt ? ` 한국시간 자정(0시)에 초기화됩니다.` : "";
  const hint =
    status.action === "collect" && status.tier === "trial"
      ? " 개인 토큰을 연결하면 수집 제한이 없어집니다."
      : "";
  return base + tail + hint;
}

/**
 * 외부 계정(account_kind != 'owned') 등록 수 + 티어 한도. (D-024)
 * accounts POST 게이트가 새 외부 계정 추가 전에 호출한다.
 */
export async function getExternalAccountUsage(
  admin: SupabaseClient,
  userId: string,
  tier?: UsageTier
): Promise<{ tier: UsageTier; count: number; limit: number; allowed: boolean }> {
  const resolvedTier = tier ?? (await resolveTier(admin, userId));
  const limit = ACCOUNT_LIMITS[resolvedTier];
  const { count, error } = await admin
    .from(ACCOUNTS)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("account_kind", "owned");
  if (error) throw error;
  const used = count ?? 0;
  return { tier: resolvedTier, count: used, limit, allowed: used < limit };
}

/** 두 미터 + 티어를 한 번에 — 카운트다운 UI / 상태 엔드포인트용. */
export async function getAllMeters(
  admin: SupabaseClient,
  userId: string
): Promise<{ tier: UsageTier; collect: MeterStatus; llm: MeterStatus }> {
  const tier = await resolveTier(admin, userId);
  const [collect, llm] = await Promise.all([
    getMeterStatus(admin, userId, "collect", tier),
    getMeterStatus(admin, userId, "llm", tier),
  ]);
  return { tier, collect, llm };
}
