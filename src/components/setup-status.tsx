"use client";

import { CircleAlert, Loader2, KeyRound } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Supabase 연결 진단 카드(D-026) — 문제가 있을 때만 노출.
 * 정상(ready)일 땐 null 을 반환해 랜딩을 깔끔하게 둔다(로그인 상태는 SignInCard 가 표시).
 */
export function SetupStatus() {
  const { status, error } = useAuth();

  if (status === "ready") return null;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Supabase 연결
          </CardTitle>
          {status === "unconfigured" ? (
            <Badge variant="secondary">
              <CircleAlert /> 환경변수 미설정
            </Badge>
          ) : status === "error" ? (
            <Badge variant="destructive">
              <CircleAlert /> 오류
            </Badge>
          ) : (
            <Badge variant="outline">
              <Loader2 className="animate-spin" /> 확인 중
            </Badge>
          )}
        </div>
        <CardDescription>로그인·데이터 저장을 위한 백엔드 연결 상태.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {status === "unconfigured" && (
          <p className="text-muted-foreground">
            <code className="bg-muted rounded px-1 py-0.5">.env.local</code> 에{" "}
            <code className="bg-muted rounded px-1 py-0.5">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            /{" "}
            <code className="bg-muted rounded px-1 py-0.5">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            를 채워야 로그인이 동작합니다. (docs/08_SETUP.md)
          </p>
        )}
        {status === "error" && (
          <p className="text-destructive">
            {error} — Supabase 프로젝트에서 Google 로그인(Authentication →
            Providers → Google)이 활성화됐는지 확인하세요.
          </p>
        )}
        {status === "loading" && (
          <p className="text-muted-foreground">세션 확인 중…</p>
        )}
      </CardContent>
    </Card>
  );
}
