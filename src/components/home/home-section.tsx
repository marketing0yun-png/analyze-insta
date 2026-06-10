"use client";

import { AccountsCard } from "@/components/accounts/accounts-card";
import { CompareHeroCard } from "@/components/accounts/compare-hero-card";
import { useAuth } from "@/components/auth/auth-provider";
import { SignInCard } from "@/components/auth/sign-in-card";
import { ConnectCard } from "@/components/credentials/connect-card";
import { useCredentials } from "@/components/credentials/credentials-provider";
import { DemoHome } from "@/components/demo/demo-home";
import { HashtagCard } from "@/components/hashtags/hashtag-card";
import { SetupStatus } from "@/components/setup-status";

/**
 * 홈 본문(D-026·D-032) — 인증·토큰 상태로 분기.
 *  - 로그아웃(데모): 구글 로그인 카드 + 목업 미리보기(DemoHome).
 *  - 로그인 + 토큰 미연결: 온보딩으로 ConnectCard 를 본문 상단에 크게 노출.
 *  - 로그인 + 토큰 연결됨: 설정 카드는 헤더 계정 메뉴로 빠지고
 *    순기능(계정 목록)이 최상단에 온다. 사용량 미터도 계정 메뉴에서 확인.
 */
export function HomeSection() {
  const { status, isAuthenticated } = useAuth();
  const { loading: credLoading, connected } = useCredentials();
  const showReal = isAuthenticated;
  const showDemo = status === "ready" && !isAuthenticated;

  return (
    <section className="mb-8 space-y-3">
      <SetupStatus />
      {!isAuthenticated && <SignInCard />}
      {showReal && (
        <>
          {/* 토큰 미연결(체험) 동안에만 온보딩 카드 — 연결되면 헤더 메뉴로 이동 */}
          {!credLoading && !connected && <ConnectCard />}
          <AccountsCard />
          <CompareHeroCard />
          <HashtagCard />
        </>
      )}
      {showDemo && <DemoHome />}
    </section>
  );
}
