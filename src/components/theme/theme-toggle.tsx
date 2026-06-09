"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";

/**
 * 라이트/다크 전환 토글(D-027).
 * 마운트 전엔 아이콘을 고정해 SSR 하이드레이션 불일치를 피한다.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      suppressHydrationWarning
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={isDark ? "라이트 모드" : "다크 모드"}
      className="text-muted-foreground hover:text-foreground"
    >
      {/* 두 아이콘을 겹쳐 두고 회전/페이드로 전환 — 부드러운 트랜지션 */}
      <Sun className="size-[1.15rem] scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute top-1/2 left-1/2 size-[1.15rem] -translate-x-1/2 -translate-y-1/2 scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0" />
    </Button>
  );
}
