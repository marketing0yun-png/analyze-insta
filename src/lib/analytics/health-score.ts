/**
 * 계정 건강점수 (0~100) — 순수 함수. 서버/클라이언트 공용(의존: engagement-benchmark 뿐).
 *
 * 왜 만드나: 참여율 하나만으로 줄세우면 "반응의 일부"만 본다(저장·공유·바이럴 누락).
 * 추가 수집 없이 **지금 데이터로 계산되는 4개 축**을 가중 합산해 *참고용* 종합 점수를 준다.
 * ⚠️ 절대 점수가 아니라 공개지표 기반 휴리스틱이다 — UI 에 반드시 그렇게 표기한다.
 *
 * 4개 축:
 *   ① 반응   — 참여율 ÷ 규모별 기대치 (기대치 2배면 만점). 내 계정은 도달기반으로 자동 교체.
 *   ② 소통   — 댓글 비중 = 댓글 ÷ (좋아요+댓글). 댓글은 좋아요보다 강한 관심 신호.
 *   ③ 꾸준함 — 주당 업로드 (주 3회 이상 만점).
 *   ④ 확산   — 릴스 비중 (릴스는 비팔로워=신규고객 도달의 핵심, 30% 이상 만점).
 *
 * ⚠️ 가중치는 **반응 축의 신뢰도**에 따라 둘 중 하나로 갈린다(D-030 후속):
 *   - 도달기반(내 계정, reachBased): 반응40·소통20·꾸준함20·확산20 — 반응이 신뢰도 높아 크게.
 *   - 팔로워기반(외부 계정):       반응20·소통30·꾸준함25·확산25 — 팔로워 참여율은 신뢰도가
 *     낮으므로(저장·공유·도달 누락) 반응 비중을 낮추고 나머지 축을 키운다.
 *
 * 결측 축은 가중에서 빼고 남은 축으로 재정규화한다 — 데이터 없는 항목이 점수를 부당히 깎지 않게.
 */

import { gradeEngagement } from "./engagement-benchmark";

export type HealthInput = {
  engagementRate: number | null;
  followers: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  postsPerWeek: number | null;
  /** 릴스 비중(%) 0~100. null 이면 '확산' 축 제외. */
  reelsSharePct: number | null;
  /** 내 계정(delegated)만 — 있으면 '반응'을 도달기반 참여율로 계산(더 정확). */
  avgReach?: number | null;
};

export type HealthTier = "good" | "fair" | "weak" | "unknown";

export type SubKey = "response" | "interaction" | "consistency" | "spread";

export type HealthSub = {
  key: SubKey;
  label: string; // 반응 / 소통 / 꾸준함 / 확산
  score: number | null; // 0~100, 결측이면 null
  weight: number; // 0~1
  note: string; // 좋음 / 보통 / 약함 / — (score 기반)
};

export type HealthScore = {
  /** 0~100 가중평균(결측 재정규화). 전부 결측이면 null. */
  score: number | null;
  tier: HealthTier;
  label: string; // 좋음 / 보통 / 주의 / 측정 전
  subs: HealthSub[];
  /** "반응 좋음 · 확산 약함" 식 한 줄 요약. */
  summary: string;
  /** 반응 축이 도달기반(내 계정)으로 계산됐는지. */
  reachBased: boolean;
};

const SUB_KEYS: SubKey[] = [
  "response",
  "interaction",
  "consistency",
  "spread",
];

/** 도달기반 반응(내 계정) — 신뢰도 높은 반응에 40%. */
const WEIGHTS_REACH: Record<SubKey, number> = {
  response: 0.4,
  interaction: 0.2,
  consistency: 0.2,
  spread: 0.2,
};

/** 팔로워기반 반응(외부 계정) — 참여율 신뢰도가 낮아 반응을 20%로 낮추고 나머지를 키움. */
const WEIGHTS_FOLLOWER: Record<SubKey, number> = {
  response: 0.2,
  interaction: 0.3,
  consistency: 0.25,
  spread: 0.25,
};

const SUB_LABEL: Record<SubKey, string> = {
  response: "반응",
  interaction: "소통",
  consistency: "꾸준함",
  spread: "확산",
};

/** 만점 기준(휴리스틱 — 범례에 그대로 노출). */
const CONSISTENCY_FULL = 3; // 주 3회 업로드
// 댓글 비중 2% 만점(D-030 후속 강화). 댓글은 좋아요보다 드물고 품질 높은 신호이며,
// "댓글 유도→도달 확장" 트렌드를 반영해 같은 댓글에도 더 후한 점수를 준다(기존 3%→2%).
const INTERACTION_FULL = 0.02;
const SPREAD_FULL = 30; // 릴스 비중 30%
const REACH_ER_FULL = 6; // 도달기반 참여율 6%

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const round = (n: number) => Math.round(n);

/** 점수(0~100) → 한국어 한 단어. */
function word(score: number | null): string {
  if (score == null) return "—";
  if (score >= 70) return "좋음";
  if (score >= 45) return "보통";
  return "약함";
}

/** 반응 축 점수 + 도달기반 여부. */
function responseScore(input: HealthInput): {
  score: number | null;
  reachBased: boolean;
} {
  const reaction =
    input.avgLikes != null || input.avgComments != null
      ? (input.avgLikes ?? 0) + (input.avgComments ?? 0)
      : null;

  // 내 계정: 도달기반 참여율(반응 ÷ 도달) — 팔로워 분모보다 정확.
  if (input.avgReach != null && input.avgReach > 0 && reaction != null) {
    const reachER = (reaction / input.avgReach) * 100;
    return { score: clamp((reachER / REACH_ER_FULL) * 100), reachBased: true };
  }

  // 외부 계정: 규모 보정 참여율(기대치 대비 배율, 2배면 만점).
  const grade = gradeEngagement(input.engagementRate, input.followers);
  if (grade.ratioToBenchmark == null) return { score: null, reachBased: false };
  return { score: clamp((grade.ratioToBenchmark / 2) * 100), reachBased: false };
}

/** 입력 지표로 건강점수 산출. */
export function computeHealthScore(input: HealthInput): HealthScore {
  const resp = responseScore(input);

  // 소통: 댓글 비중.
  const totalReaction = (input.avgLikes ?? 0) + (input.avgComments ?? 0);
  const interaction =
    (input.avgLikes != null || input.avgComments != null) && totalReaction > 0
      ? clamp(
          ((input.avgComments ?? 0) / totalReaction / INTERACTION_FULL) * 100
        )
      : null;

  // 꾸준함: 주당 업로드.
  const consistency =
    input.postsPerWeek != null
      ? clamp((input.postsPerWeek / CONSISTENCY_FULL) * 100)
      : null;

  // 확산: 릴스 비중.
  const spread =
    input.reelsSharePct != null
      ? clamp((input.reelsSharePct / SPREAD_FULL) * 100)
      : null;

  const rawSubs: Record<SubKey, number | null> = {
    response: resp.score,
    interaction,
    consistency,
    spread,
  };

  // 반응 축이 도달기반(신뢰도↑)이면 반응에 더 큰 가중치, 아니면 보수적 가중치.
  const weights = resp.reachBased ? WEIGHTS_REACH : WEIGHTS_FOLLOWER;

  const subs: HealthSub[] = SUB_KEYS.map((key) => {
    const s = rawSubs[key] == null ? null : round(rawSubs[key]!);
    return {
      key,
      label: SUB_LABEL[key],
      score: s,
      weight: weights[key],
      note: word(s),
    };
  });

  // 결측 축을 빼고 남은 가중으로 재정규화.
  let weighted = 0;
  let weightSum = 0;
  for (const s of subs) {
    if (s.score == null) continue;
    weighted += s.score * s.weight;
    weightSum += s.weight;
  }

  if (weightSum === 0) {
    return {
      score: null,
      tier: "unknown",
      label: "측정 전",
      subs,
      summary: "점수를 낼 데이터가 부족해요(수집·팔로워 확인).",
      reachBased: resp.reachBased,
    };
  }

  const score = round(weighted / weightSum);
  const tier: HealthTier = score >= 70 ? "good" : score >= 45 ? "fair" : "weak";
  const label = tier === "good" ? "좋음" : tier === "fair" ? "보통" : "주의";

  // 요약: 가장 강한 축·가장 약한 축을 한 줄로.
  const present = subs
    .filter((s): s is HealthSub & { score: number } => s.score != null)
    .sort((a, b) => b.score - a.score);
  const best = present[0];
  const worst = present[present.length - 1];
  const summary =
    best.key === worst.key
      ? `${best.label} ${word(best.score)}`
      : `${best.label} ${word(best.score)} · ${worst.label} ${word(worst.score)}`;

  return { score, tier, label, subs, summary, reachBased: resp.reachBased };
}
