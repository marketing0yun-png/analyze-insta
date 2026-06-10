import Link from "next/link";
import { Sparkles } from "lucide-react";

import { HomeSection } from "@/components/home/home-section";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
      {/* 히어로 */}
      <header className="mb-10">
        <Badge className="bg-gradient-brand mb-5 gap-1.5 border-0 px-3 py-1 text-white shadow-sm">
          <Sparkles className="size-3.5" /> 육아·출산 인스타 트렌드·경쟁 분석
        </Badge>
        {/* 모바일 포함 항상 강제 줄바꿈 — 자연 줄바꿈으로 "한눈에"가 찢어지는 것 방지 */}
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          경쟁사 인스타를
          <br />
          <span className="text-gradient-brand">한눈에</span> 분석하세요
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-base text-pretty sm:text-lg">
          좋아요·참여율·업로드 루틴부터 AI 콘텐츠 인사이트, 매장 비교까지.
          육아·출산 업종에 특화된 페르소나로 공개지표를 자동 수집·분석해 광고주
          리포트로 만들어 드립니다.
        </p>
      </header>

      <HomeSection />

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
