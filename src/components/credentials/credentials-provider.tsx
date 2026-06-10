"use client";

import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";

export type ConnectionStatus = {
  connected: boolean;
  ig_user_id?: string;
  token_expires_at?: string | null;
  connected_at?: string;
  reason?: string;
};

type CredentialsContextValue = {
  /** 최초 상태 조회가 끝나기 전 true (미로그인·unconfigured 는 즉시 false). */
  loading: boolean;
  /** 개인 토큰 연결 여부. 미로그인/조회 전엔 false. */
  connected: boolean;
  connection: ConnectionStatus | null;
  /** 토큰 연결·교체 직후 호출 — 상태 재조회. */
  refresh: () => Promise<void>;
};

const CredentialsContext = React.createContext<CredentialsContextValue>({
  loading: true,
  connected: false,
  connection: null,
  refresh: async () => {},
});

export function useCredentials() {
  return React.useContext(CredentialsContext);
}

/**
 * 토큰 연결 상태 공유 컨텍스트(D-032).
 * 헤더 계정 메뉴(상태 점)·홈(온보딩 카드 분기)·ConnectCard 가 같은 상태를 보도록
 * `/api/credentials` 조회를 한 곳으로 모은다 — 중복 fetch 제거.
 */
export function CredentialsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status: authStatus, isAuthenticated } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [connection, setConnection] = React.useState<ConnectionStatus | null>(
    null
  );

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/credentials", { cache: "no-store" });
      const data = (await res.json()) as ConnectionStatus;
      setConnection(data);
    } catch {
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 로그인 상태에서만 조회. setState 는 모두 fetch await 이후(refresh 내부)에만.
  React.useEffect(() => {
    if (authStatus !== "ready" || !isAuthenticated) return;
    void (async () => {
      await refresh();
    })();
  }, [authStatus, isAuthenticated, refresh]);

  // 미로그인(데모)·unconfigured 는 저장값과 무관하게 미연결로 파생.
  const value = React.useMemo<CredentialsContextValue>(() => {
    const authed = authStatus === "ready" && isAuthenticated;
    return {
      loading: authStatus === "loading" ? true : authed ? loading : false,
      connected: authed && connection?.connected === true,
      connection: authed ? connection : null,
      refresh,
    };
  }, [authStatus, isAuthenticated, loading, connection, refresh]);

  return (
    <CredentialsContext.Provider value={value}>
      {children}
    </CredentialsContext.Provider>
  );
}
