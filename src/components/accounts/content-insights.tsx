"use client";

import * as React from "react";
import {
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";

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
import type {
  ContentInsights as Insights,
  FreqItem,
} from "@/lib/analytics/content-insights";

type InsightsResponse = {
  account: { id: string; username: string };
  insights: Insights;
};

type AnalyzeResult = {
  analyzed: number;
  skipped: number;
  model: string | null;
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ko-KR");
}

/** 빈도 막대 목록(소구점 등) — 최대값 대비 너비. recharts 없이 가볍게. */
function FreqBars({ items }: { items: FreqItem[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">분석된 항목이 없습니다.</p>;
  }
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="text-sm">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <span className="truncate">{it.label}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {it.count}
            </span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${max > 0 ? (it.count / max) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Chips({ items }: { items: FreqItem[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">—</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <Badge key={it.label} variant="secondary" className="font-normal">
          {it.label}
          {it.count > 1 && (
            <span className="text-muted-foreground ml-1">×{it.count}</span>
          )}
        </Badge>
      ))}
    </div>
  );
}

export function ContentInsights({ id }: { id: string }) {
  const { status: authStatus } = useAuth();
  const [data, setData] = React.useState<Insights | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch(
      `/api/accounts/insights?id=${encodeURIComponent(id)}`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "불러오기 실패");
    return (json as InsightsResponse).insights;
  }, [id]);

  React.useEffect(() => {
    if (authStatus !== "ready") return;
    let active = true;
    (async () => {
      try {
        const insights = await load();
        if (active) setData(insights);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "오류");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus, load]);

  async function runAnalyze(reanalyze: boolean) {
    setAnalyzing(true);
    setNote(null);
    setError(null);
    try {
      const res = await fetch("/api/accounts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reanalyze }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "분석 실패");
        return;
      }
      const r = json.result as AnalyzeResult;
      setNote(
        r.analyzed > 0
          ? `분석 완료 · 새로 ${r.analyzed}개 분석${r.skipped > 0 ? ` (기존 ${r.skipped}개 건너뜀)` : ""}`
          : `새로 분석할 게시물이 없습니다${r.skipped > 0 ? ` (이미 ${r.skipped}개 분석됨)` : ""}.`
      );
      setData(await load());
    } catch {
      setError("분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  if (authStatus !== "ready" || loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> 인사이트 불러오는 중…
      </p>
    );
  }

  const hasData = data && data.analyzedPosts > 0;

  return (
    <div className="space-y-4">
      {/* 분석 실행 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => runAnalyze(false)}
          disabled={analyzing}
        >
          {analyzing ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          {hasData ? "새 게시물 분석" : "AI 분석 실행"}
        </Button>
        {hasData && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => runAnalyze(true)}
            disabled={analyzing}
          >
            전체 재분석
          </Button>
        )}
        {data?.lastAnalyzedAt && (
          <span className="text-muted-foreground text-xs">
            마지막 분석{" "}
            {new Date(data.lastAnalyzedAt).toLocaleString("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {data.model && ` · ${data.model}`}
          </span>
        )}
      </div>

      {note && <p className="text-muted-foreground text-xs">{note}</p>}
      {error && (
        <div className="text-destructive border-destructive/30 rounded-md border p-3 text-sm">
          {error}
        </div>
      )}

      {!hasData ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            아직 AI 콘텐츠 분석이 없습니다.{" "}
            <Sparkles className="inline size-3" /> <strong>AI 분석 실행</strong>
            을 눌러 캡션·포맷을 분석하세요.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 소구점 빈도 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">주요 소구점</CardTitle>
              <CardDescription>
                반응을 끄는 구매 동기·강조점 빈도 ({data.analyzedPosts}개 게시물
                기준).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FreqBars items={data.appealPoints} />
            </CardContent>
          </Card>

          {/* 톤 / 포맷 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">카피 톤</CardTitle>
              </CardHeader>
              <CardContent>
                <Chips items={data.tones} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">콘텐츠 구성</CardTitle>
              </CardHeader>
              <CardContent>
                <Chips items={data.formats} />
              </CardContent>
            </Card>
          </div>

          {/* 키워드 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">키워드</CardTitle>
              <CardDescription>콘텐츠 전반의 핵심어.</CardDescription>
            </CardHeader>
            <CardContent>
              <Chips items={data.keywords} />
            </CardContent>
          </Card>

          {/* 게시물별 분석 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">게시물별 분석</CardTitle>
              <CardDescription>최신순. 주제·소구점·톤.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.posts.map((p) => (
                <div
                  key={p.externalMediaId}
                  className="space-y-1.5 rounded-md border p-2.5 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">
                      {p.topic?.trim() || (
                        <span className="text-muted-foreground italic">
                          (주제 없음)
                        </span>
                      )}
                    </p>
                    {p.permalink && (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="게시물 열기"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </div>
                  {p.summary && (
                    <p className="text-muted-foreground text-xs">{p.summary}</p>
                  )}
                  {p.appealPoints.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.appealPoints.map((ap, i) => (
                        <Badge
                          key={`${p.externalMediaId}-ap-${i}`}
                          variant="outline"
                          className="font-normal"
                        >
                          {ap}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                    {p.tone && <span>톤: {p.tone}</span>}
                    {p.format && <span>구성: {p.format}</span>}
                    <span className="flex items-center gap-1">
                      <Heart className="size-3" /> {fmt(p.likeCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="size-3" /> {fmt(p.commentsCount)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
