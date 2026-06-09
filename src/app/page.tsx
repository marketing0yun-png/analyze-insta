import Link from "next/link";
import { Sparkles } from "lucide-react";

import { HomeSection } from "@/components/home/home-section";
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
    desc: "Next.js + Tailwind + shadcn/ui + PWA, Supabase 구글 로그인, 기본 스키마.",
    state: "done" as const,
  },
  {
    n: 1,
    title: "외부계정 공개지표 대시보드",
    desc: "토큰 입력 → Business Discovery 수집 → 참여율·업로드 루틴·해시태그 분석.",
    state: "done" as const,
  },
  {
    n: 2,
    title: "AI 콘텐츠 분석",
    desc: "캡션 → Gemini(Vertex AI) 주제·소구점·카피톤·키워드 분석.",
    state: "done" as const,
  },
  {
    n: "2.5",
    title: "매장 비교 분석",
    desc: "참여율 순위 + 매장 선택 → 정량 비교표 + LLM 냉정 평가.",
    state: "done" as const,
  },
  {
    n: 3,
    title: "내 계정 완전분석 + 비교 + 배포",
    desc: "내 계정 노출·도달 인사이트 수집·비교, 일괄·일일캐시. (배포 잔여: 마스터·구글로그인)",
    state: "current" as const,
  },
  {
    n: "3.5",
    title: "프리미엄 티어 + 사용량 미터",
    desc: "2시간 슬라이딩 한도(수집·지표 / 분석·비교) + 카운트다운 미터 구현. 잔여: 오너 토큰 폴백·개수 한도·안내 문구.",
    state: "current" as const,
  },
];

const stateLabel = {
  done: { label: "완료", cls: "" },
  current: { label: "진행 중", cls: "bg-emerald-600 text-white" },
  next: { label: "다음", cls: "" },
  later: { label: "예정", cls: "" },
} as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
      {/* 히어로 */}
      <header className="mb-10">
        <Badge className="bg-gradient-brand mb-5 gap-1.5 border-0 px-3 py-1 text-white shadow-sm">
          <Sparkles className="size-3.5" /> 인스타 트렌드·경쟁 분석
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          경쟁사 인스타를
          <br className="hidden sm:block" />{" "}
          <span className="text-gradient-brand">한눈에</span> 분석하세요
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-base text-pretty sm:text-lg">
          좋아요·참여율·업로드 루틴부터 AI 콘텐츠 인사이트, 매장 비교까지.
          공개지표를 자동으로 수집·분석해 광고주 리포트로 만들어 드립니다.
        </p>
      </header>

      <HomeSection />

      <section>
        <h2 className="text-muted-foreground mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
          로드맵
          <span className="bg-border h-px flex-1" />
        </h2>
        <div className="grid gap-3">
          {phases.map((p) => {
            const s = stateLabel[p.state];
            const isCurrent = p.state === "current";
            return (
              <Card
                key={p.n}
                className={isCurrent ? "ring-gradient-brand bg-card/90" : undefined}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        isCurrent
                          ? "bg-gradient-brand inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                          : "bg-muted text-muted-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                      }
                    >
                      {p.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{p.title}</CardTitle>
                        <Badge
                          variant={isCurrent ? "default" : "secondary"}
                          className={s.cls}
                        >
                          {s.label}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1.5">
                        {p.desc}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <footer className="text-muted-foreground mt-12 space-y-2 border-t pt-6 text-xs">
        <p>외부 계정은 공개지표만(노출·도달 ❌). 토큰은 서버사이드 전용·암호화.</p>
        <p className="flex items-center gap-3">
          <Link href="/privacy" className="hover:text-foreground underline">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="hover:text-foreground underline">
            이용약관
          </Link>
        </p>
      </footer>
    </main>
  );
}
