"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Lightbulb,
  Loader2,
  Scale,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Wrench,
} from "lucide-react";

import { EngagementBadge } from "@/components/accounts/engagement-badge";
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
  topFormats: { label: string; pct: number }[];
  appealPoints: { label: string; count: number }[];
};

type AccountVerdict = {
  username: string;
  rank: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  contentIdeas: string[];
};

type ComparisonReport = {
  summary: string;
  keyDifferences: string[];
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

export function CompareView() {
  const { status: authStatus } = useAuth();
  const [items, setItems] = React.useState<RankItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [benchmarkIds, setBenchmarkIds] = React.useState<string[]>([]);
  const [comparing, setComparing] = React.useState(false);
  const [result, setResult] = React.useState<CompareResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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

  async function runCompare() {
    setComparing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/accounts/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, benchmarkIds }),
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
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Scale className="size-5" /> 매장 비교 분석
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          참여율 순으로 정렬됩니다. 비교할 매장을 2~5개 선택하면 LLM이 냉정하게
          평가합니다. (외부는 공개지표, 내 계정은 노출·도달까지 포함)
        </p>
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
                    className={`rounded-md border p-2.5 text-sm ${
                      isBench
                        ? "border-amber-300 bg-amber-50/60"
                        : checked
                          ? "border-primary bg-primary/5"
                          : ""
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
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">
                            @{it.username}
                          </span>
                          <Badge variant="secondary" className="shrink-0">
                            {KIND_LABEL[it.account_kind]}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          팔로워 {fmt(it.followers)} · 분석 {it.analyzedPosts}개
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
                              ? "border-amber-300 bg-amber-100 text-amber-700"
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
              <p className="text-muted-foreground pt-1 text-xs">
                ※ 따라잡을 <strong>벤치마크 목표</strong>를 직접 지정하세요(선택).
                지정하면 나머지 매장이 그 수준에 도달할 방법 중심으로 평가합니다.
                미지정 시 참여율 순으로 자동 비교합니다.
              </p>
              <p className="text-muted-foreground text-xs">
                ※ 등급은 <strong>팔로워 규모별 기대 참여율</strong>에 견준
                값입니다. 비즈니스·대형 계정은 평균 참여율이 낮은 게 정상이라
                규모별로 다르게 평가합니다.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={runCompare}
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

          {error && (
            <div className="text-destructive border-destructive/30 rounded-md border p-3 text-sm">
              {error}
            </div>
          )}

          {result && <CompareResult data={result} />}
        </>
      )}
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
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
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
