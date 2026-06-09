"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";

type AuthStatus = "loading" | "ready" | "unconfigured" | "error";

type AuthContextValue = {
  status: AuthStatus;
  /** 로그인한 사용자(구글). 로그아웃(데모) 상태면 null. */
  user: User | null;
  error: string | null;
  /** 구글로 로그인됐는지. false면 데모(목업) 모드. */
  isAuthenticated: boolean;
  /**
   * 구글 로그인 시작 — OAuth 리다이렉트(`/auth/callback`로 복귀).
   * Supabase 대시보드에서 Google provider가 활성화돼 있어야 동작한다(미설정 시 에러 반환).
   */
  signInWithGoogle: () => Promise<{ error: string | null }>;
  /** 로그아웃 → 데모 모드로 복귀. */
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue>({
  status: "loading",
  user: null,
  error: null,
  isAuthenticated: false,
  signInWithGoogle: async () => ({ error: "인증이 초기화되지 않았습니다." }),
  signOut: async () => {},
});

export function useAuth() {
  return React.useContext(AuthContext);
}

/**
 * 구글 로그인 기반 인증(D-026).
 * - 익명인증 자동 생성 없음. 로그인 전(데모)에는 세션 없이 목업만 본다.
 * - 실제 이용(수집·분석·토큰 연결)은 구글 로그인 후에만 가능(서버 라우트가 401로 차단).
 * - Supabase env 미설정 시 앱을 깨지 않고 "unconfigured" 로 표시한다.
 */
type CoreState = Pick<AuthContextValue, "status" | "user" | "error">;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<CoreState>(() =>
    publicEnv.supabaseUrl && publicEnv.supabaseAnonKey
      ? { status: "loading", user: null, error: null }
      : { status: "unconfigured", user: null, error: null }
  );

  const signInWithGoogle = React.useCallback(async (): Promise<{
    error: string | null;
  }> => {
    if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
      return { error: "Supabase 환경변수가 설정되지 않았습니다." };
    }
    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "구글 로그인에 실패했습니다.",
      };
    }
  }, []);

  const signOut = React.useCallback(async () => {
    if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return;
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setState({ status: "ready", user: null, error: null });
    } catch {
      /* 로그아웃 실패는 조용히 무시 — 다음 새로고침에서 정리 */
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
        // user 가 있으면 로그인, 없으면 데모(로그아웃) — 둘 다 "ready".
        if (active) setState({ status: "ready", user: user ?? null, error: null });
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
      // 익명인증은 더 이상 생성하지 않음 — user 존재 = 구글 로그인.
      isAuthenticated: state.user != null && state.user.is_anonymous !== true,
      signInWithGoogle,
      signOut,
    }),
    [state, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
