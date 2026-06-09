import type { EngagementTier } from "@/lib/analytics/engagement-benchmark";
import { gradeEngagement } from "@/lib/analytics/engagement-benchmark";

/**
 * 참여율 등급 시각화 (Phase 2.5) — 색상 배지 + 기대치 대비 미터.
 * 규모별 기대치를 반영한 gradeEngagement() 결과를 가시적으로 보여준다.
 * 순수 presentational(훅 없음) — 서버/클라이언트 양쪽에서 사용.
 */

const TIER_STYLE: Record<
  EngagementTier,
  { badge: string; bar: string }
> = {
  active: {
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    bar: "bg-emerald-500",
  },
  good: {
    badge:
      "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
    bar: "bg-sky-500",
  },
  average: {
    badge:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    bar: "bg-amber-500",
  },
  low: {
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
    bar: "bg-rose-500",
  },
  unknown: {
    badge: "bg-muted text-muted-foreground border-border",
    bar: "bg-muted-foreground",
  },
};

/** 등급 배지 1개(라벨만). */
export function EngagementBadge({
  rate,
  followers,
  className = "",
}: {
  rate: number | null;
  followers: number | null;
  className?: string;
}) {
  const g = gradeEngagement(rate, followers);
  const s = TIER_STYLE[g.tier];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s.badge} ${className}`}
      title={g.description}
    >
      {g.label}
    </span>
  );
}

/**
 * 등급 미터 — 참여율 값 + 등급 배지 + 기대치 대비 막대.
 * 기대치(벤치마크) 지점에 눈금을 둬 "기대보다 위/아래"를 한눈에.
 */
export function EngagementMeter({
  rate,
  followers,
}: {
  rate: number | null;
  followers: number | null;
}) {
  const g = gradeEngagement(rate, followers);
  const s = TIER_STYLE[g.tier];

  // 막대 스케일: 기대치를 60% 지점에 두고, 그 2배(활발 경계)를 만점 근처로.
  const fullScale = g.benchmark * 2 || 1;
  const ratePct =
    rate != null ? Math.min(100, (rate / fullScale) * 100) : 0;
  const benchMarkPct = Math.min(100, (g.benchmark / fullScale) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold tracking-tight">
          {rate != null ? `${rate}%` : "—"}
        </span>
        <EngagementBadge rate={rate} followers={followers} />
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${s.bar}`}
          style={{ width: `${ratePct}%` }}
        />
        {/* 기대치(벤치마크) 눈금 */}
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground/40"
          style={{ left: `${benchMarkPct}%` }}
          aria-hidden
        />
      </div>
      <p className="text-muted-foreground text-xs">{g.description}</p>
    </div>
  );
}
