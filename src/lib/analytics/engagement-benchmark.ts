/**
 * 참여율 등급/벤치마크 (Phase 2.5) — 순수 함수.
 * 참여율((좋아요+댓글)/팔로워)을 **팔로워 규모별 기대치**에 견줘 등급화한다.
 *
 * 왜 규모 보정인가: 인스타는 계정이 클수록 평균 참여율이 구조적으로 낮아진다
 * (특히 비즈니스/대형 계정). 같은 1%여도 1만 계정엔 낮고 100만 계정엔 양호하다.
 * 그래서 절대 % 가 아니라 "규모 대비 기대치" 로 평가해야 사용자가 오해하지 않는다.
 *
 * 외부 의존성 없이 서버/클라이언트 공용(account-metrics 와 동일 사상).
 */

export type EngagementTier = "active" | "good" | "average" | "low" | "unknown";

export type EngagementGrade = {
  tier: EngagementTier;
  /** 활발 / 양호 / 평균 / 다소 낮음 / 측정 전 */
  label: string;
  /** 한 줄 설명(규모 맥락 포함). */
  description: string;
  /** 이 규모의 기대 평균 참여율(%). */
  benchmark: number;
  /** 팔로워 규모 밴드 라벨. */
  followersBand: string;
  /** 기대치 대비 배율(참여율/벤치마크). 미터 시각화용. rate 없으면 null. */
  ratioToBenchmark: number | null;
};

/** 팔로워 규모별 기대 평균 참여율(%) + 밴드 라벨. */
function benchmarkFor(followers: number | null): {
  benchmark: number;
  band: string;
} {
  if (followers == null) return { benchmark: 2.0, band: "규모 미상" };
  if (followers < 10_000) return { benchmark: 4.0, band: "1만 미만" };
  if (followers < 100_000) return { benchmark: 2.5, band: "1만~10만" };
  if (followers < 1_000_000) return { benchmark: 1.5, band: "10만~100만" };
  return { benchmark: 1.0, band: "100만 이상" };
}

/**
 * 참여율(%) + 팔로워로 등급 산출.
 * 기준: 기대치 b 대비 — ≥2b 활발 / ≥b 양호 / ≥0.5b 평균 / <0.5b 다소 낮음.
 */
export function gradeEngagement(
  rate: number | null,
  followers: number | null
): EngagementGrade {
  const { benchmark, band } = benchmarkFor(followers);

  if (rate == null) {
    return {
      tier: "unknown",
      label: "측정 전",
      description: "참여율을 계산할 데이터가 부족합니다(수집·팔로워 확인).",
      benchmark,
      followersBand: band,
      ratioToBenchmark: null,
    };
  }

  const ratio = benchmark > 0 ? rate / benchmark : 0;
  const sizeNote = `${band} 규모 기대치 ${benchmark}%`;

  if (rate >= benchmark * 2) {
    return {
      tier: "active",
      label: "활발",
      description: `기대치의 2배 이상 — 팬덤·반응이 매우 강합니다 (${sizeNote}).`,
      benchmark,
      followersBand: band,
      ratioToBenchmark: ratio,
    };
  }
  if (rate >= benchmark) {
    return {
      tier: "good",
      label: "양호",
      description: `규모 대비 기대 이상입니다 (${sizeNote}).`,
      benchmark,
      followersBand: band,
      ratioToBenchmark: ratio,
    };
  }
  if (rate >= benchmark * 0.5) {
    return {
      tier: "average",
      label: "평균",
      description: `규모 평균 수준입니다 (${sizeNote}).`,
      benchmark,
      followersBand: band,
      ratioToBenchmark: ratio,
    };
  }
  return {
    tier: "low",
    label: "다소 낮음",
    description: `규모 평균을 밑돕니다 (${sizeNote}). 큰 계정은 낮게 나오는 게 정상일 수 있습니다.`,
    benchmark,
    followersBand: band,
    ratioToBenchmark: ratio,
  };
}
