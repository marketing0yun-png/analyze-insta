import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/** 카카오톡 채널 1:1 문의 링크(D-032). */
const KAKAO_CHAT_URL = "http://pf.kakao.com/_xjdCpn/chat";

/**
 * 전 화면 공통 상단 헤더(D-027) — 글래스(블러) 바 + 브랜드 + 카톡 문의 + 계정 메뉴(D-032) + 테마 토글.
 * sticky 로 스크롤 시에도 고정. 하단에 얇은 그라데이션 라인으로 포인트.
 */
export function AppHeader() {
  return (
    <header className="bg-background/70 supports-[backdrop-filter]:bg-background/55 sticky top-0 z-40 w-full backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label="홈으로"
        >
          <span className="bg-gradient-brand inline-flex size-8 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105">
            <Logo className="size-[1.1rem]" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            트렌드 분석기
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {/* 카카오톡 문의 CTA — 카톡 시그니처 옐로 + 말풍선 아이콘 */}
          <a
            href={KAKAO_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="카카오톡 문의하기"
            title="카카오톡 문의하기"
            className="inline-flex size-9 items-center justify-center rounded-full bg-[#FEE500] text-[#191919] shadow-sm transition-transform hover:scale-105"
          >
            <MessageCircle className="size-5 fill-[#191919]" />
          </a>
          <AccountMenu />
          <ThemeToggle />
        </div>
      </div>
      {/* 얇은 그라데이션 구분선 */}
      <div className="bg-gradient-brand-soft h-px w-full opacity-60" />
    </header>
  );
}
