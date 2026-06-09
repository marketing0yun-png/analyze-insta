"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Scale, Sparkles } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * 비교 분석 부각 히어로 카드(홈) — '매장 비교'를 묻히지 않게 전면에 노출.
 * 계정 2개 이상이면 CTA 활성, 미만이면 보이되 비활성 + 안내(기능 존재 인지).
 */
export function CompareHeroCard() {
  const { status: authStatus } = useAuth();
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (authStatus !== "ready") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/accounts", { cache: "no-store" });
        const data = await res.json();
        if (active) setCount((data.accounts ?? []).length);
      } catch {
        if (active) setCount(0);
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus]);

  const ready = (count ?? 0) >= 2;

  return (
    <Card className="bg-gradient-brand relative overflow-hidden border-0 text-white shadow-md">
      {/* 장식 글로우 */}
      <div className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-white/15 blur-2xl" />
      <CardContent className="relative flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white/90 uppercase">
            <Sparkles className="size-3.5" /> 가장 강력한 기능
          </p>
          <h3 className="mt-1.5 flex items-center gap-2 text-lg font-bold">
            <Scale className="size-5" /> 매장 비교 분석
          </h3>
          <p className="mt-1 max-w-md text-sm text-white/85">
            여러 매장을 참여율 순으로 줄 세우고, LLM이 강점·약점·개선책·콘텐츠
            아이디어까지 <strong>냉정하게</strong> 진단합니다.
          </p>
        </div>
        <div className="shrink-0">
          {ready ? (
            <Button
              asChild
              size="lg"
              className="bg-white font-semibold text-[#c026a8] shadow-sm hover:bg-white/90"
            >
              <Link href="/compare">
                비교 시작 <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <div className="text-right">
              <Button
                size="lg"
                disabled
                className="bg-white/20 font-semibold text-white"
              >
                비교 시작
              </Button>
              <p className="mt-1.5 text-xs text-white/80">
                계정 <strong>2개 이상</strong> 등록하면 열려요
                {count != null && ` (현재 ${count}개)`}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
