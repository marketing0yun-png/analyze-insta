import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 사용량 미터 (Phase 3.5 · D-024) — "누가 얼마나 쓰나" 가로 레이어.
 *
 * 두 개의 슬라이딩 윈도우 미터(둘 다 "최근 2시간 N회", 누적 없음):
 *   ① collect — 수집·지표 묶음 (Meta·무료/오너 쿼터 보호). 실질 발동 = /collect.
 *               지표(/metrics) 조회는 무계측 — 새 데이터 받을 때(수집)만 소비.
 *   ② llm     — 분석·비교 묶음 (LLM·비용). /analyze + /compare 공용 풀.
 *
 * 슬라이딩 = 쓴 시각 기준 2시간 뒤 1칸 회복(예: 08:34 사용 → 10:34 회복).
 * 모든 함수는 service-role(admin) 클라이언트 필요 — usage_events 쓰기 정책 없음,
 * api_credentials 는 RLS 정책 자체가 없어 admin 만 접근 가능.
 */

/** 미터 종류 — DB enum `analyze_insta_usage_action` 과 일치. */
export type UsageAction = "collect" | "llm";

/** 티어. trial=개인 토큰 미등록(오너 토큰 체험) / personal=본인 토큰 등록. */
export type UsageTier = "trial" | "personal";

/** 윈도우 = 최근 2시간(ms). */
export const USAGE_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * 액션×티어 한도. `null` = 무제한.
 *  - collect: 체험 5 / 개인 무제한 (개인은 본인 Meta 쿼터를 쓰므로 오너 보호 불필요).
 *  - llm:     두 티어 모두 5 공용 (LLM 실비용은 토큰과 무관하게 운영자 부담 → 안 풀림).
 */
export const USAGE_LIMITS: Record<UsageAction, Record<UsageTier, number | null>> = {
  collect: { trial: 5, personal: null },
  llm: { trial: 5, personal: 5 },
};

const USAGE = "analyze_insta_usage_events";
const CREDENTIALS = "analyze_insta_api_credentials";
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
  /** 윈도우당 한도. null = 무제한. */
  limit: number | null;
  /** 최근 2시간 내 사용 횟수. */
  used: number;
  /** 남은 횟수. null = 무제한. */
  remaining: number | null;
  /** 막혔을 때 1칸이 회복되는 시각(ISO). 여유 있거나 무제한이면 null. */
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

  const since = new Date(Date.now() - USAGE_WINDOW_MS).toISOString();
  const { data, error } = await admin
    .from(USAGE)
    .select("created_at")
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const events = (data ?? []) as { created_at: string }[];
  const used = events.length;
  const remaining = Math.max(0, limit - used);
  const allowed = remaining > 0;

  // 막혔으면: (used - limit) 번째로 오래된 사용이 2시간 지나면 1칸 회복.
  //   used==limit → events[0](가장 오래된) + 2h. (방어적으로 초과분도 처리.)
  let resetAt: string | null = null;
  if (!allowed) {
    const idx = used - limit; // >= 0
    const target = events[idx];
    if (target) {
      resetAt = new Date(
        Date.parse(target.created_at) + USAGE_WINDOW_MS
      ).toISOString();
    }
  }

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
  const when = status.resetAt
    ? new Date(status.resetAt).toLocaleTimeString("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const base = `${label} 횟수를 모두 썼어요 (2시간 ${status.limit}회).`;
  const tail = when ? ` ${when}(KST)에 다시 가능합니다.` : "";
  const hint =
    status.action === "collect" && status.tier === "trial"
      ? " 개인 토큰을 연결하면 수집 제한이 없어집니다."
      : "";
  return base + tail + hint;
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
