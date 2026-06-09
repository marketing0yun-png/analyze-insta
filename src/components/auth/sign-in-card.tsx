"use client";

import * as React from "react";
import { LogIn, Loader2, LogOut } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * 구글 로그인 카드(D-026).
 * - 로그아웃(데모) 상태: "구글로 시작하기" 버튼 + 데모 안내.
 * - 로그인 상태: 계정 이메일 + 로그아웃 버튼.
 * ⚠️ Supabase 대시보드에서 Google provider 활성화가 선행돼야 동작한다(docs/12_GUIDE_GOOGLE_LOGIN.md).
 */
export function SignInCard() {
  const { status, isAuthenticated, user, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status === "unconfigured" || status === "error") return null;

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error);
      setBusy(false);
    }
    // 성공 시 OAuth 리다이렉트가 진행됨 — 별도 처리 없음.
  }

  if (isAuthenticated) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-between gap-3 py-4 text-sm">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">로그인됨</p>
            <p className="truncate font-medium">{user?.email ?? "구글 계정"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut /> 로그아웃
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ring-gradient-brand bg-card/90 w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LogIn className="size-4" /> 구글로 시작하기
        </CardTitle>
        <CardDescription>
          지금은 <strong>데모 모드</strong>예요 — 미리 정해진 예시 데이터만
          볼 수 있어요. 내 인스타 계정을 실제로 분석하려면 구글 계정으로
          가입(로그인)하세요. 무료로 바로 시작할 수 있어요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Button
          size="lg"
          className="w-full"
          onClick={handleSignIn}
          disabled={busy || status === "loading"}
        >
          {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
          구글로 로그인하고 시작
        </Button>
        {error && (
          <p className="text-destructive text-xs">
            {error} (운영자: Supabase Google OAuth 설정을 확인하세요 —
            docs/12_GUIDE_GOOGLE_LOGIN.md)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
