"use client";

import * as React from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const THEME_EVENT = "themechange";

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

/** 테마는 `<html>`.dark 클래스(외부 상태)를 단일 출처로 삼는다. */
function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}
function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.style.colorScheme = t;
  try {
    localStorage.setItem("theme", t);
  } catch {
    /* 저장 실패는 무시 — 세션 내에서는 동작 */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * 라이트/다크 테마 컨텍스트(D-027).
 * - 초기 .dark 적용은 layout 의 no-flash 인라인 스크립트가 담당(깜빡임 없음).
 * - 여기서는 useSyncExternalStore 로 그 DOM 상태를 구독만 한다(effect/ setState 없음).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setTheme = React.useCallback((t: Theme) => applyTheme(t), []);
  const toggle = React.useCallback(
    () => applyTheme(getSnapshot() === "dark" ? "light" : "dark"),
    []
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
