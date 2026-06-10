"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Compass,
  HeartPulse,
  Lightbulb,
  Loader2,
  Scale,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";

import { EngagementBadge } from "@/components/accounts/engagement-badge";
import { Glossary } from "@/components/accounts/glossary";
import {
  computeHealthScore,
  type HealthScore,
  type HealthTier,
} from "@/lib/analytics/health-score";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// 서버 전용 모듈(compare-accounts/account-report)을 끌어오지 않도록 응답 타입만 로컬 선언.
type RankItem = {
  id: string;
  username: string;
  account_kind: "competitor" | "influencer" | "owned";
  followers: number | null;
  engagementRate: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  postsPerWeek: number | null;
  reelsSharePct: number;
  avgReach: number | null;
  collectedPosts: number;
  analyzedPosts: number;
};

type CompareSummary = {
  username: string;
  kind: "competitor" | "influencer" | "owned";
  isBenchmark: boolean;
  followers: number | null;
  engagementRate: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  postsPerWeek: number | null;
  analyzedPosts: number;
  avgReach: number | null;
  avgImpressions: number | null;
  reelsSharePct: number;
  topFormats: { label: string; pct: number }[];
  appealPoints: { label: string; count: number }[];
};

type AccountVerdict = {
  username: string;
  rank: number;
  category: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  contentIdeas: string[];
};

type ComparisonReport = {
  summary: string;
  keyDifferences: string[];
  commonStrengths: string[];
  commonWeaknesses: string[];
  opportunities: string[];
  accounts: AccountVerdict[];
  model: string;
};

type CompareResponse = { accounts: CompareSummary[]; report: ComparisonReport };

const KIND_LABEL: Record<RankItem["account_kind"], string> = {
  competitor: "경쟁사",
  influencer: "인플루언서",
  owned: "내 계정",
};

/** 비교 대상 중 내 계정(노출·도달 보유)이 하나라도 있으면 도달 열을 표시. */
function hasOwnedInsights(accounts: CompareSummary[]): boolean {
  return accounts.some((a) => a.avgReach != null || a.avgImpressions != null);
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ko-KR");
}

const MAX_SELECT = 5;

/** 리더보드 항목 → 건강점수. */
function healthFromRank(it: RankItem): HealthScore {
  return computeHealthScore({
    engagementRate: it.engagementRate,
    followers: it.followers,
    avgLikes: it.avgLikes,
    avgComments: it.avgComments,
    postsPerWeek: it.postsPerWeek,
    reelsSharePct: it.reelsSharePct,
    avgReach: it.avgReach,
  });
}

/** 비교 결과 요약 → 건강점수. */
function healthFromSummary(a: CompareSummary): HealthScore {
  return computeHealthScore({
    engagementRate: a.engagementRate,
    followers: a.followers,
    avgLikes: a.avgLikes,
    avgComments: a.avgComments,
    postsPerWeek: a.postsPerWeek,
    reelsSharePct: a.reelsSharePct,
    avgReach: a.avgReach,
  });
}

const HEALTH_STYLE: Record<HealthTier, string> = {
  good: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  fair: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  weak: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

/** 건강점수 배지 — 점수 + 등급. title 에 축별 요약. */
function HealthBadge({ h, className = "" }: { h: HealthScore; className?: string }) {
  const title =
    h.score == null
      ? h.summary
      : `${h.summary} · ${h.subs
          .map((s) => `${s.label} ${s.score ?? "—"}`)
          .join(" / ")}${h.reachBased ? " (반응=도달기반)" : ""}`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${HEALTH_STYLE[h.tier]} ${className}`}
      title={title}
    >
      <HeartPulse className="size-3" />
      {h.score == null ? "건강 측정 전" : `건강 ${h.score} · ${h.label}`}
    </span>
  );
}

export function CompareView() {
  const { status: authStatus } = useAuth();
  const [items, setItems] = React.useState<RankItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [benchmarkIds, setBenchmarkIds] = React.useState<string[]>([]);
  const [comparing, setComparing] = React.useState(false);
  const [result, setResult] = React.useState<CompareResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [warnOpen, setWarnOpen] = React.useState(false);

  React.useEffect(() => {
    if (authStatus !== "ready") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/accounts/ranking", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "불러오기 실패");
        if (active) setItems((json.items ?? []) as RankItem[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "오류");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
      setBenchmarkIds(benchmarkIds.filter((x) => x !== id)); // 해제 시 벤치마크도 해제
    } else {
      if (selected.length >= MAX_SELECT) return;
      setSelected([...selected, id]);
    }
  }

  function toggleBenchmark(id: string) {
    setBenchmarkIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function runCompare(ids: string[], benches: string[]) {
    setComparing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/accounts/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, benchmarkIds: benches }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "비교 실패");
        return;
      }
      setResult(json as CompareResponse);
    } catch {
      setError("비교 중 오류가 발생했습니다.");
    } finally {
      setComparing(false);
    }
  }

  // 선택했지만 아직 AI 분석 전인 매장(콘텐츠 평가가 비게 됨) — 비교 전 차단.
  const selectedUnanalyzed = items.filter(
    (it) => selected.includes(it.id) && it.analyzedPosts === 0
  );

  // 비교 실행 게이트: 미분석 계정이 하나라도 섞여 있으면 알럿 모달로 막는다.
  function handleCompareClick() {
    if (selectedUnanalyzed.length > 0) {
      setWarnOpen(true);
      return;
    }
    runCompare(selected, benchmarkIds);
  }

  // 모달 액션: 미분석 계정을 선택에서 제외하고, 2개 이상 남으면 곧장 비교.
  function excludeAndCompare() {
    const unanalyzedIds = new Set(selectedUnanalyzed.map((it) => it.id));
    const keptIds = selected.filter((id) => !unanalyzedIds.has(id));
    const keptBenches = benchmarkIds.filter((id) => !unanalyzedIds.has(id));
    setSelected(keptIds);
    setBenchmarkIds(keptBenches);
    setWarnOpen(false);
    if (keptIds.length >= 2) {
      runCompare(keptIds, keptBenches);
    } else {
      setError(
        "분석된 계정이 2개 미만이라 비교할 수 없습니다. 미분석 계정을 먼저 분석한 뒤 다시 시도하세요."
      );
    }
  }

  const backLink = (
    <Link
      href="/"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" /> 목록으로
    </Link>
  );

  return (
    <div className="space-y-5">
      {backLink}

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="bg-gradient-brand inline-flex size-9 items-center justify-center rounded-xl text-white shadow-sm">
            <Scale className="size-5" />
          </span>
          매장 비교 분석
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          비교할 매장을 2~5개 고르면 AI가 솔직하게 평가해드려요.
        </p>
        {/* 긴 안내는 접이식으로 — 모바일 첫 화면에 리더보드가 바로 보이게(D-032) */}
        <details className="mt-2 rounded-md border border-amber-300/60 bg-amber-50/60 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <summary className="cursor-pointer p-2.5 font-medium select-none">
            ⓘ 사용 순서 · 보이는 데이터 안내
          </summary>
          <div className="space-y-1.5 px-2.5 pb-2.5">
            <p>
              <strong>순서:</strong> 각 매장을 <strong>수집 → AI 분석</strong>
              까지 끝낸 뒤 비교하세요. 분석이 안 된 매장은 콘텐츠
              평가(소구점·톤·아이디어)가 비어 표시됩니다. (분석은 홈의 “선택
              수집 &amp; 분석” 또는 각 계정의 “콘텐츠 인사이트 → AI 분석”)
            </p>
            <p>
              순위는 참여율(게시물에 반응한 사람 비율)이 높은 순입니다. 외부
              계정은 공개된 숫자만, 내 계정은 도달·노출까지 포함해요.
            </p>
          </div>
        </details>
      </header>

      {authStatus !== "ready" || loading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> 리더보드 불러오는 중…
        </p>
      ) : items.length < 2 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            비교하려면 분석 대상이 2개 이상 필요합니다. 먼저 계정을 등록·수집하세요.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 리더보드 + 선택 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">참여율 리더보드</CardTitle>
              <CardDescription>
                (좋아요+댓글)/팔로워 기준. 비교할 매장을 선택하세요 (
                {selected.length}/{MAX_SELECT}).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((it, i) => {
                const checked = selected.includes(it.id);
                const disabled = !checked && selected.length >= MAX_SELECT;
                const isBench = benchmarkIds.includes(it.id);
                return (
                  <div
                    key={it.id}
                    onClick={() => !disabled && toggle(it.id)}
                    className={`rounded-xl border p-2.5 text-sm transition-colors ${
                      isBench
                        ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10"
                        : checked
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40"
                    } ${disabled ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        disabled={disabled}
                        className="pointer-events-none size-4 shrink-0"
                      />
                      <span className="text-muted-foreground w-5 shrink-0 font-mono text-xs">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        {/* 계정명은 자르지 않고 줄바꿈 — 모바일에서도 전부 읽히게(D-032) */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium break-all">
                            @{it.username}
                          </span>
                          <Badge variant="secondary" className="shrink-0">
                            {KIND_LABEL[it.account_kind]}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          팔로워 {fmt(it.followers)} · 분석 {it.analyzedPosts}개
                          {it.analyzedPosts === 0 && (
                            <span className="ml-1 text-amber-600 dark:text-amber-500">
                              · ⚠ AI 분석 필요
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5">
                          <HealthBadge h={healthFromRank(it)} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tracking-tight">
                          {it.engagementRate != null
                            ? `${it.engagementRate}%`
                            : "—"}
                        </p>
                        <EngagementBadge
                          rate={it.engagementRate}
                          followers={it.followers}
                          className="mt-0.5"
                        />
                      </div>
                    </div>
                    {checked && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBenchmark(it.id);
                          }}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                            isBench
                              ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300"
                              : "text-muted-foreground hover:bg-muted border-border"
                          }`}
                        >
                          <Star
                            className={`size-3 ${isBench ? "fill-amber-500 text-amber-500" : ""}`}
                          />
                          {isBench ? "벤치마크 목표" : "벤치마크로 지정"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* 긴 ※ 안내는 접이식으로 — 리더보드가 화면을 차지하게(D-032) */}
              <details className="text-muted-foreground pt-1 text-xs">
                <summary className="hover:text-foreground cursor-pointer font-medium select-none">
                  ⓘ 벤치마크 지정 · 등급 · 건강점수 안내
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  <p>
                    ※ 따라잡을 <strong>벤치마크 목표</strong>를 직접
                    지정하세요(선택). 지정하면 나머지 매장이 그 수준에 도달할
                    방법 중심으로 평가합니다. 미지정 시 참여율 순으로 자동
                    비교합니다.
                  </p>
                  <p>
                    ※ 등급은 <strong>팔로워 규모별 기대 참여율</strong>에 견준
                    값입니다. 비즈니스·대형 계정은 평균 참여율이 낮은 게
                    정상이라 규모별로 다르게 평가합니다.
                  </p>
                  <p>
                    ※ <strong>건강점수</strong>는 참여율·소통·꾸준함·확산을 합친{" "}
                    <strong>참고용 0~100점</strong>입니다(절대 점수 아님).
                  </p>
                </div>
              </details>
              <div className="space-y-2 pt-1">
                <HealthLegend />
                <Glossary />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleCompareClick}
              disabled={selected.length < 2 || comparing}
            >
              {comparing ? <Loader2 className="animate-spin" /> : <Scale />}
              비교 분석 ({selected.length})
            </Button>
            {selected.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected([]);
                  setBenchmarkIds([]);
                }}
                disabled={comparing}
              >
                선택 해제
              </Button>
            )}
          </div>

          {selectedUnanalyzed.length > 0 && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50/60 p-2.5 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
              선택한 매장 중{" "}
              <strong>
                {selectedUnanalyzed.map((it) => `@${it.username}`).join(", ")}
              </strong>
              은(는) 아직 AI 분석 전이라 콘텐츠 평가가 비어 나옵니다. 더 정확한
              비교를 원하면 먼저 분석을 실행하세요. (선택 매장 전부가 미분석이면
              비교가 막힙니다)
            </div>
          )}

          {error && (
            <div className="text-destructive border-destructive/30 rounded-md border p-3 text-sm">
              {error}
            </div>
          )}

          {result && <CompareResult data={result} />}
        </>
      )}

      {warnOpen && (
        <UnanalyzedWarnModal
          accounts={selectedUnanalyzed}
          onExclude={excludeAndCompare}
          onClose={() => setWarnOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * 비교 실행을 막는 알럿 모달 — 선택 중 미분석 계정이 있을 때 띄운다.
 * 사용자는 ① 미분석 제외 후 비교, ② 닫고 먼저 분석 중 하나를 골라야 한다.
 */
function UnanalyzedWarnModal({
  accounts,
  onExclude,
  onClose,
}: {
  accounts: RankItem[];
  onExclude: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <Card
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <AlertTriangle className="size-4" />
            </span>
            미분석 계정이 포함돼 있어요
          </CardTitle>
          <CardDescription>
            아래 계정은 AI 분석 전이라 콘텐츠 평가가 비어 나옵니다. 정확한 비교를
            위해 분석을 먼저 끝내거나, 제외하고 진행하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1.5">
            {accounts.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50/60 px-2.5 py-1.5 text-sm dark:bg-amber-950/20"
              >
                <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="font-medium">@{it.username}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  AI 분석 필요
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="button" onClick={onExclude} className="sm:flex-1">
              미분석 제외하고 비교
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="sm:flex-1"
            >
              닫고 먼저 분석하기
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            ※ 분석은 홈의 “선택 수집 &amp; 분석” 또는 각 계정의 “콘텐츠 인사이트 →
            AI 분석”에서 실행할 수 있어요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ListBlock({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone?: "good" | "bad" | "fix" | "idea";
}) {
  if (items.length === 0) return null;
  const color =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-destructive"
        : tone === "fix"
          ? "text-amber-600"
          : tone === "idea"
            ? "text-primary"
            : "";
  return (
    <div>
      <p className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
        {icon} {title}
      </p>
      <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

/** 팔로워 규모별 기대 참여율(engagement-benchmark.ts 와 동일 기준). */
const BENCHMARK_ROWS: { band: string; benchmark: string }[] = [
  { band: "1만 미만", benchmark: "4.0%" },
  { band: "1만~10만", benchmark: "2.5%" },
  { band: "10만~100만", benchmark: "1.5%" },
  { band: "100만 이상", benchmark: "1.0%" },
];

const GRADE_ROWS: { label: string; cut: string; cls: string }[] = [
  { label: "활발", cut: "기대치의 2배 이상", cls: "text-emerald-600" },
  { label: "양호", cut: "기대치 이상", cls: "text-emerald-600" },
  { label: "평균", cut: "기대치의 절반 이상", cls: "text-muted-foreground" },
  { label: "다소 낮음", cut: "기대치의 절반 미만", cls: "text-amber-600" },
];

/** 참여율 공식 + 규모별 기대치 + 등급 컷 범례(접이식 — 반발감 완화). */
function GradeLegend() {
  return (
    <details className="bg-muted/30 group mt-3 rounded-md border text-xs">
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 p-2.5 font-medium select-none">
        <Scale className="size-3.5" /> 참여율 공식 · 등급 기준 보기
      </summary>
      <div className="space-y-3 border-t p-3">
        <div>
          <p className="font-medium">참여율 공식</p>
          <p className="text-muted-foreground mt-1 font-mono text-[11px]">
            참여율(%) = (좋아요 + 댓글) ÷ 팔로워 × 100
          </p>
        </div>
        <div>
          <p className="font-medium">규모별 기대 참여율</p>
          <p className="text-muted-foreground mt-0.5 mb-1.5 text-[11px]">
            계정이 클수록 평균 참여율은 구조적으로 낮아 규모별로 다르게 봅니다.
          </p>
          <table className="w-full">
            <tbody className="text-muted-foreground">
              {BENCHMARK_ROWS.map((r) => (
                <tr key={r.band} className="border-b last:border-0">
                  <td className="py-1">{r.band}</td>
                  <td className="py-1 text-right font-medium">{r.benchmark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="font-medium">등급 기준 (해당 규모 기대치 대비)</p>
          <table className="mt-1.5 w-full">
            <tbody>
              {GRADE_ROWS.map((r) => (
                <tr key={r.label} className="border-b last:border-0">
                  <td className={`py-1 font-medium ${r.cls}`}>{r.label}</td>
                  <td className="text-muted-foreground py-1 text-right">
                    {r.cut}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

/** 건강점수 4개 축·가중·만점 기준 범례(접이식) + "참고 점수" 고지. */
const HEALTH_AXES: {
  name: string;
  wExt: string;
  wOwned: string;
  means: string;
  full: string;
}[] = [
  {
    name: "반응",
    wExt: "20%",
    wOwned: "40%",
    means: "참여율(반응한 사람 비율)이 규모 대비 높은가",
    full: "규모별 기대치의 2배 이상 (내 계정은 도달 대비로 더 정확히)",
  },
  {
    name: "소통",
    wExt: "30%",
    wOwned: "20%",
    means: "댓글이 활발한가 (좋아요보다 진한 관심)",
    full: "댓글 비중 2% 이상",
  },
  {
    name: "꾸준함",
    wExt: "25%",
    wOwned: "20%",
    means: "업로드를 꾸준히 하는가",
    full: "주 3회 이상",
  },
  {
    name: "확산",
    wExt: "25%",
    wOwned: "20%",
    means: "릴스(짧은 영상)로 새 고객에게 닿는가",
    full: "릴스 비중 30% 이상",
  },
];

function HealthLegend() {
  return (
    <details className="bg-muted/30 group mt-3 rounded-md border text-xs">
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 p-2.5 font-medium select-none">
        <HeartPulse className="size-3.5" /> 건강점수란? · 계산 기준 보기
      </summary>
      <div className="space-y-3 border-t p-3">
        <p className="text-muted-foreground">
          좋아요·참여율 하나만 보면 놓치는 부분이 많아, 공개된 숫자로 계산되는 4가지를
          합쳐 <strong>0~100점</strong>으로 보여드려요. 절대 점수가 아니라{" "}
          <strong>참고용 신호</strong>예요.
        </p>
        <table className="w-full">
          <thead>
            <tr className="text-muted-foreground border-b text-left">
              <th className="py-1 pr-2 font-medium">항목</th>
              <th className="py-1 pr-2 text-center font-medium">
                비중
                <br />
                <span className="font-normal">외부·내계정</span>
              </th>
              <th className="py-1 pr-2 font-medium">무엇을 보나</th>
              <th className="py-1 text-right font-medium">만점 기준</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {HEALTH_AXES.map((a) => (
              <tr key={a.name} className="border-b last:border-0 align-top">
                <td className="py-1.5 pr-2 font-medium whitespace-nowrap">
                  {a.name}
                </td>
                <td className="py-1.5 pr-2 text-center whitespace-nowrap">
                  {a.wExt} · {a.wOwned}
                </td>
                <td className="py-1.5 pr-2">{a.means}</td>
                <td className="py-1.5 text-right">{a.full}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-muted-foreground">
          ※ <strong>외부 계정은 ‘반응(참여율)’의 신뢰도가 낮아</strong>(저장·공유·도달을
          알 수 없음) 비중을 20%로 낮추고 소통·꾸준함·확산을 키웠어요. 내 계정은
          도달까지 알 수 있어 반응을 40%로 봅니다.
        </p>
        <p className="text-muted-foreground">
          ※ 70점↑ <span className="text-emerald-600">좋음</span> · 45점↑{" "}
          <span className="text-amber-600">보통</span> · 그 미만{" "}
          <span className="text-rose-600">주의</span>. 데이터가 없는 항목은 빼고
          나머지로 계산해요.
        </p>
      </div>
    </details>
  );
}

function CompareResult({ data }: { data: CompareResponse }) {
  const { report, accounts } = data;
  const summaryByUser = new Map(accounts.map((a) => [a.username, a]));
  const showReach = hasOwnedInsights(accounts);

  return (
    <div className="space-y-4">
      {/* 정량 비교표 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">정량 비교</CardTitle>
          <CardDescription>참여율 순위 순.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="py-1.5 pr-2 font-medium">매장</th>
                <th className="py-1.5 pr-2 text-right font-medium">참여율</th>
                <th className="py-1.5 pr-2 text-center font-medium">등급</th>
                <th className="py-1.5 pr-2 text-center font-medium">건강점수</th>
                <th className="py-1.5 pr-2 text-right font-medium">평균반응</th>
                {showReach && (
                  <th className="py-1.5 pr-2 text-right font-medium">
                    평균도달<span className="text-[10px]">(내계정)</span>
                  </th>
                )}
                <th className="py-1.5 pr-2 text-right font-medium">주간업로드</th>
                <th className="py-1.5 text-right font-medium">팔로워</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, i) => (
                <tr key={a.username} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    <span className="text-muted-foreground mr-1 font-mono text-xs">
                      {i + 1}
                    </span>
                    @{a.username}
                    {a.isBenchmark && (
                      <Star className="ml-1 inline size-3 fill-amber-500 text-amber-500" />
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-medium">
                    {a.engagementRate != null ? `${a.engagementRate}%` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-center">
                    <EngagementBadge
                      rate={a.engagementRate}
                      followers={a.followers}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-center">
                    <HealthBadge h={healthFromSummary(a)} />
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {fmt((a.avgLikes ?? 0) + (a.avgComments ?? 0))}
                  </td>
                  {showReach && (
                    <td className="py-1.5 pr-2 text-right">
                      {a.avgReach != null ? fmt(a.avgReach) : "—"}
                    </td>
                  )}
                  <td className="py-1.5 pr-2 text-right">
                    {a.postsPerWeek != null ? `${a.postsPerWeek}회` : "—"}
                  </td>
                  <td className="py-1.5 text-right">{fmt(a.followers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <GradeLegend />
          <HealthLegend />
        </CardContent>
      </Card>

      {/* LLM 냉정 평가 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4" /> 냉정 평가
          </CardTitle>
          {report.model && (
            <CardDescription>모델: {report.model}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {report.summary && (
            <p className="bg-muted/40 rounded-md border p-3 text-sm">
              {report.summary}
            </p>
          )}

          {report.keyDifferences.length > 0 && (
            <div>
              <p className="text-xs font-medium">핵심 차이</p>
              <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {report.keyDifferences.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 비교군 공통 진단 — 전원이 잘하거나 부족한 점(객관 기준). */}
          {(report.commonStrengths.length > 0 ||
            report.commonWeaknesses.length > 0) && (
            <div className="bg-muted/40 space-y-3 rounded-md border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Users className="size-3.5" /> 비교군 공통 진단
                <span className="text-muted-foreground font-normal">
                  (대상 전체에 해당)
                </span>
              </p>
              <ListBlock
                icon={<ThumbsUp className="size-3" />}
                title="모두 잘하는 점"
                items={report.commonStrengths}
                tone="good"
              />
              <ListBlock
                icon={<ThumbsDown className="size-3" />}
                title="모두 부족한 점"
                items={report.commonWeaknesses}
                tone="bad"
              />
            </div>
          )}

          {report.opportunities.length > 0 && (
            <div className="border-primary/30 bg-primary/5 rounded-md border p-3">
              <p className="text-primary flex items-center gap-1.5 text-xs font-medium">
                <Lightbulb className="size-3.5" /> 기회 · 다음 액션
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                {report.opportunities.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          {report.accounts.map((v) => {
            const s = summaryByUser.get(v.username);
            return (
              <div key={v.username} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground font-mono text-xs">
                    {v.rank}위
                  </span>
                  <span className="font-medium">@{v.username}</span>
                  {s?.isBenchmark && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                      <Star className="size-3 fill-amber-500 text-amber-500" />{" "}
                      벤치마크 목표
                    </span>
                  )}
                  {s && (
                    <>
                      <span className="text-muted-foreground text-xs">
                        참여율{" "}
                        {s.engagementRate != null ? `${s.engagementRate}%` : "—"}
                      </span>
                      <EngagementBadge
                        rate={s.engagementRate}
                        followers={s.followers}
                      />
                    </>
                  )}
                </div>
                {v.category && (
                  <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                    <Compass className="mt-0.5 size-3 shrink-0" />
                    <span>
                      <span className="font-medium">카테고리:</span> {v.category}
                    </span>
                  </p>
                )}
                <ListBlock
                  icon={<ThumbsUp className="size-3" />}
                  title="강점"
                  items={v.strengths}
                  tone="good"
                />
                <ListBlock
                  icon={<ThumbsDown className="size-3" />}
                  title="약점"
                  items={v.weaknesses}
                  tone="bad"
                />
                <ListBlock
                  icon={<Wrench className="size-3" />}
                  title="개선책"
                  items={v.recommendations}
                  tone="fix"
                />
                <ListBlock
                  icon={<Sparkles className="size-3" />}
                  title="시도할 콘텐츠 아이디어"
                  items={v.contentIdeas}
                  tone="idea"
                />
              </div>
            );
          })}

          <p className="text-muted-foreground text-xs">
            공개지표·콘텐츠 전략 기준 평가입니다. 노출·도달은 <strong>내 계정</strong>
            에만 포함되며, 외부 계정은 추정하지 않습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
