"use client";

import * as React from "react";
import { Loader2, LogIn, LogOut, UserCircle, X } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { useCredentials } from "@/components/credentials/credentials-provider";
import { ConnectCard } from "@/components/credentials/connect-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UsageMeterCard } from "@/components/usage/usage-meter-card";

/**
 * 헤더 계정 메뉴(D-032) — 로그인·토큰 연결·사용량을 본문에서 걷어내
 * 상단 바의 버튼 하나(상태 점 포함)로 모은다. 순기능(계정 목록)이 최상단에 오도록.
 *  - 미로그인: "로그인" 버튼(구글 OAuth 직행).
 *  - 로그인: 프로필 버튼 + 상태 점(초록=개인 토큰 / 주황=체험·미연결).
 *  - 클릭 → 모바일은 바텀 시트, PC(sm↑)는 우상단 드롭다운 패널.
 */
export function AccountMenu() {
  const { status, isAuthenticated, user, signInWithGoogle, signOut } =
    useAuth();
  const { loading: credLoading, connected } = useCredentials();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // 시트가 열려 있는 동안 배경 스크롤 잠금 + Escape 닫기.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "unconfigured" || status === "error") return null;

  if (!isAuthenticated) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={status === "loading" || busy}
        onClick={async () => {
          setBusy(true);
          const { error } = await signInWithGoogle();
          // 성공 시 OAuth 리다이렉트 — 실패했을 때만 버튼을 되살린다.
          if (error) setBusy(false);
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />} 로그인
      </Button>
    );
  }

  const dotClass = credLoading
    ? "bg-muted-foreground animate-pulse"
    : connected
      ? "bg-emerald-500"
      : "bg-amber-500";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="내 계정 · 토큰 연결 · 사용량"
        title="내 계정 · 토큰 연결 · 사용량"
        className="border-input bg-background/60 hover:bg-muted relative inline-flex size-9 items-center justify-center rounded-full border transition-colors"
      >
        <UserCircle className="size-5" />
        <span
          className={`ring-background absolute top-0 right-0 size-2.5 rounded-full ring-2 ${dotClass}`}
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="내 계정 패널"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-background absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:top-16 sm:right-4 sm:bottom-auto sm:w-[26rem] sm:max-h-[80dvh] sm:rounded-2xl sm:border"
          >
            {/* 모바일 시트 핸들 */}
            <div className="bg-muted-foreground/30 mx-auto mb-3 h-1 w-10 rounded-full sm:hidden" />

            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">내 계정 · 사용량</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* 로그인 정보 */}
              <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {user?.email ?? "구글 계정"}
                  </p>
                  <div className="mt-1">
                    {credLoading ? (
                      <Badge variant="outline">
                        <Loader2 className="animate-spin" /> 확인 중
                      </Badge>
                    ) : connected ? (
                      <Badge className="bg-emerald-600 text-white">
                        개인 토큰 연결됨
                      </Badge>
                    ) : (
                      <Badge variant="secondary">체험 모드 · 토큰 미연결</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void signOut()}
                >
                  <LogOut /> 로그아웃
                </Button>
              </div>

              <ConnectCard />
              <UsageMeterCard />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
