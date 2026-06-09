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
  /** 현재 세션이 익명인지. 구글 로그인 연결 버튼 노출 판단용. */
  isAnonymous: boolean;
  /**
   * 익명 세션에 구글 신원 연결(link identity) — 데이터 보존(Phase 3, D-025).
   * Supabase 대시보드에서 Google OAuth 가 활성화돼 있어야 동작한다(미설정 시 에러 반환).
   */
  linkGoogle: () => Promise<{ error: string | null }>;
};

const AuthContext = React.createContext<AuthContextValue>({
  status: "loading",
  user: null,
  error: null,
  isAnonymous: false,
  linkGoogle: async () => ({ error: "인증이 초기화되지 않았습니다." }),
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
type CoreState = Pick<AuthContextValue, "status" | "user" | "error">;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<CoreState>(() =>
    publicEnv.supabaseUrl && publicEnv.supabaseAnonKey
      ? { status: "loading", user: null, error: null }
      : { status: "unconfigured", user: null, error: null }
  );

  /** 익명 → 구글 신원 연결(link identity). 데이터 보존(D-025). */
  const linkGoogle = React.useCallback(async (): Promise<{
    error: string | null;
  }> => {
    if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
      return { error: "Supabase 환경변수가 설정되지 않았습니다." };
    }
    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "구글 연결에 실패했습니다.",
      };
    }
  }, []);

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

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAnonymous: state.user?.is_anonymous === true,
      linkGoogle,
    }),
    [state, linkGoogle]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
