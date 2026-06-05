"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";

type AuthStatus = "loading" | "ready" | "unconfigured" | "error";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  error: string | null;
};

const AuthContext = React.createContext<AuthContextValue>({
  status: "loading",
  user: null,
  error: null,
});

export function useAuth() {
  return React.useContext(AuthContext);
}

/**
 * 익명인증 부트스트랩.
 * - Supabase env 미설정 시 앱을 깨지 않고 "unconfigured" 상태로 표시한다.
 * - 세션이 없으면 signInAnonymously()로 백그라운드 식별 → RLS 데이터 격리.
 * - 배포 전 구글 로그인으로 link identity (Phase 3).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthContextValue>(() =>
    publicEnv.supabaseUrl && publicEnv.supabaseAnonKey
      ? { status: "loading", user: null, error: null }
      : { status: "unconfigured", user: null, error: null }
  );

  React.useEffect(() => {
    if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return;

    const supabase = createClient();
    let active = true;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          if (active) setState({ status: "ready", user, error: null });
          return;
        }

        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        if (active)
          setState({ status: "ready", user: data.user, error: null });
      } catch (err) {
        if (active)
          setState({
            status: "error",
            user: null,
            error: err instanceof Error ? err.message : "인증 초기화 실패",
          });
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active)
        setState((prev) => ({
          ...prev,
          status: "ready",
          user: session?.user ?? null,
        }));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
