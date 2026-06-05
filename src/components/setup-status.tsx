"use client";

import { CheckCircle2, CircleAlert, Loader2, KeyRound } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function StatusBadge({ status }: { status: ReturnType<typeof useAuth>["status"] }) {
  if (status === "ready")
    return (
      <Badge className="bg-emerald-600 text-white">
        <CheckCircle2 /> 연결됨
      </Badge>
    );
  if (status === "unconfigured")
    return (
      <Badge variant="secondary">
        <CircleAlert /> 환경변수 미설정
      </Badge>
    );
  if (status === "error")
    return (
      <Badge variant="destructive">
        <CircleAlert /> 오류
      </Badge>
    );
  return (
    <Badge variant="outline">
      <Loader2 className="animate-spin" /> 확인 중
    </Badge>
  );
}

export function SetupStatus() {
  const { status, user, error } = useAuth();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> 익명 인증 / Supabase
          </CardTitle>
          <StatusBadge status={status} />
        </div>
        <CardDescription>
          로그인 없이 백그라운드 식별(RLS 데이터 격리). 배포 전 구글 로그인으로
          전환 예정.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {status === "ready" && (
          <p className="text-muted-foreground break-all">
            anon user id:{" "}
            <span className="text-foreground font-mono">{user?.id}</span>
          </p>
        )}
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
            를 채우면 익명 세션이 자동 생성됩니다. (docs/08_SETUP.md)
          </p>
        )}
        {status === "error" && (
          <p className="text-destructive">
            {error} — Supabase 프로젝트에서 Anonymous Sign-in 이 활성화됐는지
            확인하세요.
          </p>
        )}
        {status === "loading" && (
          <p className="text-muted-foreground">세션 확인 중…</p>
        )}
      </CardContent>
    </Card>
  );
}
