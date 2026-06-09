"use client";

import { AccountsCard } from "@/components/accounts/accounts-card";
import { CompareHeroCard } from "@/components/accounts/compare-hero-card";
import { useAuth } from "@/components/auth/auth-provider";
import { SignInCard } from "@/components/auth/sign-in-card";
import { ConnectCard } from "@/components/credentials/connect-card";
import { DemoHome } from "@/components/demo/demo-home";
import { HashtagCard } from "@/components/hashtags/hashtag-card";
import { SetupStatus } from "@/components/setup-status";
import { UsageMeterCard } from "@/components/usage/usage-meter-card";

/**
 * 홈 본문(D-026) — 인증 상태로 분기.
 *  - 로그인됨: 실제 기능 카드(토큰 연결·사용량·계정·해시태그).
 *  - 로그아웃(데모): 고정 목업 미리보기(DemoHome).
 *  - 로딩 중: 분기 카드를 비워 깜빡임 방지.
 */
export function HomeSection() {
  const { status, isAuthenticated } = useAuth();
  const showReal = isAuthenticated;
  const showDemo = status === "ready" && !isAuthenticated;

  return (
    <section className="mb-8 space-y-3">
      <SetupStatus />
      <SignInCard />
      {showReal && (
        <>
          <ConnectCard />
          <UsageMeterCard />
          <AccountsCard />
          <CompareHeroCard />
          <HashtagCard />
        </>
      )}
      {showDemo && <DemoHome />}
    </section>
  );
}
