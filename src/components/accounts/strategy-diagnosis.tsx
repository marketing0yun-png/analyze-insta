"use client";

import * as React from "react";
import {
  Compass,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { USAGE_REFRESH_EVENT } from "@/components/usage/usage-meter-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Diagnosis = {
  category: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  contentIdeas: string[];
  model: string;
};

type StrategyResponse = {
  account: { id: string; username: string };
  analyzedPosts: number;
  diagnosis: Diagnosis | null;
  diagnosedAt: string | null;
};

function ListBlock({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "good" | "bad" | "fix" | "idea";
}) {
  if (items.length === 0) return null;
  const color =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-destructive"
        : tone === "fix"
          ? "text-amber-600"
          : "text-primary";
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

/**
 * 단일 계정 **전략 진단** 탭 (Phase 2.5 후속).
 * 콘텐츠 인사이트가 '관찰된 사실'이라면 여기는 '판단·처방'(강점/약점/개선책/아이디어).
 * 절대 등급 기준의 객관 평가 — LLM 온디맨드(분석·비교 미터 1칸). 결과는 서버 캐시.
 */
export function StrategyDiagnosis({ id }: { id: string }) {
  const { status: authStatus } = useAuth();
  const [data, setData] = React.useState<StrategyResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (authStatus !== "ready") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/accounts/strategy?id=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "불러오기 실패");
        if (active) setData(json as StrategyResponse);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "오류");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus, id]);

  async function runDiagnosis() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "진단 실패");
        return;
      }
      setData(json as StrategyResponse);
      window.dispatchEvent(new Event(USAGE_REFRESH_EVENT));
    } catch {
      setError("진단 중 오류가 발생했습니다.");
    } finally {
      setRunning(false);
    }
  }

  if (authStatus !== "ready" || loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> 불러오는 중…
      </p>
    );
  }

  const diagnosis = data?.diagnosis ?? null;
  const noAnalysis = (data?.analyzedPosts ?? 0) === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="text-primary size-4" /> 전략 진단
              </CardTitle>
              <CardDescription className="mt-1">
                강점·약점·개선책·콘텐츠 아이디어를 <strong>절대 등급 기준</strong>으로
                냉정하게. 비교 대상 없이 이 계정만 객관 평가합니다.
              </CardDescription>
            </div>
            {!noAnalysis && (
              <Button
                type="button"
                size="sm"
                variant={diagnosis ? "outline" : "default"}
                onClick={runDiagnosis}
                disabled={running}
              >
                {running ? (
                  <Loader2 className="animate-spin" />
                ) : diagnosis ? (
                  <RefreshCw />
                ) : (
                  <Sparkles />
                )}
                {diagnosis ? "다시 진단" : "전략 진단 실행"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {noAnalysis ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              먼저 <strong>콘텐츠 인사이트</strong> 탭에서 AI 분석을 실행하세요.
              분석된 게시물이 있어야 전략 진단을 낼 수 있습니다.
            </p>
          ) : error ? (
            <div className="text-destructive border-destructive/30 rounded-md border p-3 text-sm">
              {error}
            </div>
          ) : !diagnosis ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              아직 진단 결과가 없습니다. <strong>전략 진단 실행</strong>을 누르면
              LLM이 평가합니다. (분석·비교 횟수 1회 소비)
            </p>
          ) : (
            <>
              {error && (
                <div className="text-destructive border-destructive/30 rounded-md border p-3 text-sm">
                  {error}
                </div>
              )}
              {diagnosis.category && (
                <div className="border-primary/30 bg-primary/5 rounded-md border p-3">
                  <p className="text-primary flex items-center gap-1.5 text-xs font-medium">
                    <Compass className="size-3.5" /> 카테고리·방향성
                  </p>
                  <p className="mt-1 text-sm">{diagnosis.category}</p>
                </div>
              )}
              <ListBlock
                icon={<ThumbsUp className="size-3" />}
                title="강점"
                items={diagnosis.strengths}
                tone="good"
              />
              <ListBlock
                icon={<ThumbsDown className="size-3" />}
                title="약점"
                items={diagnosis.weaknesses}
                tone="bad"
              />
              <ListBlock
                icon={<Wrench className="size-3" />}
                title="개선책"
                items={diagnosis.recommendations}
                tone="fix"
              />
              <ListBlock
                icon={<Lightbulb className="size-3" />}
                title="시도할 콘텐츠 아이디어"
                items={diagnosis.contentIdeas}
                tone="idea"
              />
              {diagnosis.strengths.length === 0 &&
                diagnosis.weaknesses.length === 0 &&
                diagnosis.recommendations.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    평가할 데이터가 부족합니다. 더 많은 게시물을 분석한 뒤 다시
                    진단해 보세요.
                  </p>
                )}
              <p className="text-muted-foreground text-xs">
                공개지표·콘텐츠 전략 기준 평가입니다. 데이터에 없는 수치는
                추정하지 않습니다.
                {data?.diagnosedAt && (
                  <>
                    {" "}
                    · {new Date(data.diagnosedAt).toLocaleString("ko-KR")} 기준
                  </>
                )}
                {diagnosis.model && <> · 모델 {diagnosis.model}</>}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
