"use client";

import * as React from "react";
import { LogIn, Loader2 } from "lucide-react";

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
 * 구글 계정 연결(link identity) 카드 — 익명 세션일 때만 노출(Phase 3, D-025).
 * 익명으로 모은 데이터를 보존한 채 구글 신원을 연결한다.
 * ⚠️ Supabase 대시보드에서 Google OAuth 활성화가 선행돼야 동작한다(docs/12_GUIDE_GOOGLE_LOGIN.md).
 * 미설정이면 버튼 클릭 시 에러를 그대로 표시한다(스캐폴딩 단계).
 */
export function GoogleLinkCard() {
  const { status, isAnonymous, linkGoogle } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status !== "ready" || !isAnonymous) return null;

  async function handleLink() {
    setBusy(true);
    setError(null);
    const { error } = await linkGoogle();
    if (error) {
      setError(error);
      setBusy(false);
    }
    // 성공 시 OAuth 리다이렉트가 진행됨 — 별도 처리 없음.
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LogIn className="size-4" /> 구글 계정 연결 (선택)
        </CardTitle>
        <CardDescription>
          지금은 익명으로 사용 중이에요. 구글 계정을 연결하면 다른 기기에서도
          같은 데이터로 이어서 쓸 수 있어요. (지금까지의 데이터는 그대로 보존)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Button onClick={handleLink} disabled={busy} variant="outline">
          {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
          구글로 연결
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
