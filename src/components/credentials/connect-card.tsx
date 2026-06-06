"use client";

import * as React from "react";
import {
  CheckCircle2,
  CircleAlert,
  Link2,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ConnectionStatus = {
  connected: boolean;
  ig_user_id?: string;
  token_expires_at?: string | null;
  connected_at?: string;
  reason?: string;
};

type SubmitResult = {
  ig_user_id: string;
  username: string | null;
  page_name: string | null;
  candidate_count: number;
  token_expires_at: string | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "미상";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ConnectCard() {
  const { status: authStatus } = useAuth();
  const [token, setToken] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [loadingStatus, setLoadingStatus] = React.useState(true);
  const [connection, setConnection] = React.useState<ConnectionStatus | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SubmitResult | null>(null);

  // 상태 조회(상태 갱신 없이 데이터만). setState는 호출부에서 await 이후에만 한다.
  const fetchStatus = React.useCallback(async (): Promise<ConnectionStatus> => {
    const res = await fetch("/api/credentials", { cache: "no-store" });
    return (await res.json()) as ConnectionStatus;
  }, []);

  // 세션 준비 시 1회 조회. setState는 모두 await 이후 → effect 동기 setState 회피.
  React.useEffect(() => {
    if (authStatus !== "ready") return;
    let active = true;
    (async () => {
      try {
        const data = await fetchStatus();
        if (active) setConnection(data);
      } catch {
        if (active) setConnection(null);
      } finally {
        if (active) setLoadingStatus(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus, fetchStatus]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "연결에 실패했습니다.");
      } else {
        setResult(data as SubmitResult);
        setToken("");
        setLoadingStatus(true);
        try {
          setConnection(await fetchStatus());
        } finally {
          setLoadingStatus(false);
        }
      }
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const connected = connection?.connected === true;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4" /> 인스타 토큰 연결
          </CardTitle>
          {loadingStatus && authStatus === "ready" ? (
            <Badge variant="outline">
              <Loader2 className="animate-spin" /> 확인 중
            </Badge>
          ) : connected ? (
            <Badge className="bg-emerald-600 text-white">
              <CheckCircle2 /> 연결됨
            </Badge>
          ) : (
            <Badge variant="secondary">
              <CircleAlert /> 미연결
            </Badge>
          )}
        </div>
        <CardDescription>
          Meta API 토큰을 입력하면 연결된 인스타 비즈니스 계정(ig_user_id)을
          추출해 <strong>암호화 저장</strong>합니다. 토큰은 서버에서만 처리되며
          화면·DB에 평문으로 남지 않습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {connected && (
          <div className="bg-muted/50 rounded-md border p-3">
            <p className="text-muted-foreground">
              연결된 IG 계정:{" "}
              <span className="text-foreground font-mono">
                {connection?.ig_user_id}
              </span>
            </p>
            <p className="text-muted-foreground mt-1">
              토큰 만료: {formatDate(connection?.token_expires_at)}
            </p>
          </div>
        )}

        {authStatus !== "ready" && (
          <p className="text-muted-foreground">
            토큰 연결은 세션이 준비된 뒤 가능합니다. (위 익명 인증 상태 확인)
          </p>
        )}

        {authStatus === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              autoComplete="off"
              placeholder={connected ? "새 토큰으로 교체하려면 입력" : "Meta API 액세스 토큰 붙여넣기"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={submitting}
            />
            <Button type="submit" disabled={submitting || !token.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> 검증 중…
                </>
              ) : (
                <>
                  <ShieldCheck /> {connected ? "토큰 교체" : "검증 후 연결"}
                </>
              )}
            </Button>
          </form>
        )}

        {result && (
          <div className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-medium">연결 성공</p>
            <p className="mt-1">
              ig_user_id: <span className="font-mono">{result.ig_user_id}</span>
              {result.username && <> · @{result.username}</>}
            </p>
            {result.candidate_count > 1 && (
              <p className="mt-1 text-xs">
                IG 비즈니스 계정이 {result.candidate_count}개 연결돼 있어 첫 번째를
                선택했습니다.
              </p>
            )}
            <p className="mt-1 text-xs">
              토큰 만료: {formatDate(result.token_expires_at)}
            </p>
          </div>
        )}

        {error && (
          <div className="text-destructive rounded-md border border-destructive/30 p-3">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
