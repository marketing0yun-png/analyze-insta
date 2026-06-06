import { Activity, TrendingUp } from "lucide-react";

import { ConnectCard } from "@/components/credentials/connect-card";
import { SetupStatus } from "@/components/setup-status";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const phases = [
  {
    n: 0,
    title: "스캐폴딩",
    desc: "Next.js + Tailwind + shadcn/ui + PWA, Supabase 익명인증, 기본 스키마.",
    state: "current" as const,
  },
  {
    n: 1,
    title: "외부계정 공개지표 대시보드",
    desc: "토큰 입력 → Business Discovery 수집 → 참여율·업로드 루틴·해시태그 분석.",
    state: "next" as const,
  },
  {
    n: 2,
    title: "AI 콘텐츠 분석",
    desc: "캡션·미디어 → Claude API 주제·소구점·카피톤 분석.",
    state: "later" as const,
  },
  {
    n: 3,
    title: "위임계정 완전분석 + 비교 + 배포",
    desc: "노출·도달 인사이트, 비교 리포트, 구글 로그인 전환.",
    state: "later" as const,
  },
];

const stateLabel = {
  current: { label: "진행 중", cls: "bg-emerald-600 text-white" },
  next: { label: "다음", cls: "" },
  later: { label: "예정", cls: "" },
} as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-lg">
            <TrendingUp className="size-5" />
          </span>
          <Badge variant="outline" className="gap-1">
            <Activity className="size-3" /> Phase 0
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Meta SNS 트렌드 분석기
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          인스타그램 중심 SNS 트렌드·경쟁 분석기. 공개지표를 수집·분석·리포트한다.
          스캐폴딩이 동작 중입니다.
        </p>
      </header>

      <section className="mb-8 space-y-3">
        <SetupStatus />
        <ConnectCard />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium tracking-tight">로드맵</h2>
        <div className="grid gap-3">
          {phases.map((p) => {
            const s = stateLabel[p.state];
            return (
              <Card key={p.n}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      Phase {p.n} · {p.title}
                    </CardTitle>
                    <Badge
                      variant={p.state === "current" ? "default" : "secondary"}
                      className={s.cls}
                    >
                      {s.label}
                    </Badge>
                  </div>
                  <CardDescription>{p.desc}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <footer className="text-muted-foreground mt-10 text-xs">
        외부 계정은 공개지표만(노출·도달 ❌). 토큰은 서버사이드 전용·암호화.
      </footer>
    </main>
  );
}
