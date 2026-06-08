"use client";

import * as React from "react";
import { Gauge, Infinity as InfinityIcon } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** 다른 컴포넌트(수집/분석/비교 성공 직후)가 즉시 갱신을 트리거할 때 쏘는 이벤트. */
export const USAGE_REFRESH_EVENT = "usage:refresh";

type Meter = {
  action: "collect" | "llm";
  tier: "trial" | "personal";
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string | null;
  allowed: boolean;
};

type Usage = { tier: "trial" | "personal"; collect: Meter; llm: Meter };

/** resetAt 까지 남은 시간을 "다음 가능 10:34 · 1시간 12분 후" 로. 지났으면 null. */
function untilLabel(resetAt: string | null, now: number): string | null {
  if (!resetAt) return null;
  const ms = Date.parse(resetAt) - now;
  if (ms <= 0) return null;
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const hhmm = new Date(resetAt).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
  });
  const rel = h > 0 ? `${h}시간 ${m}분 후` : `${m}분 후`;
  return `다음 가능 ${hhmm} · ${rel}`;
}

function MeterRow({
  title,
  hint,
  meter,
  now,
}: {
  title: string;
  hint: string;
  meter: Meter;
  now: number;
}) {
  const unlimited = meter.limit === null;
  const blocked = !unlimited && (meter.remaining ?? 0) <= 0;
  const reset = untilLabel(meter.resetAt, now);

  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
        {blocked && reset ? (
          <p className="text-destructive mt-0.5 text-xs">{reset}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        {unlimited ? (
          <Badge variant="secondary" className="gap-1">
            <InfinityIcon className="size-3" /> 무제한
          </Badge>
        ) : (
          <Badge
            variant={blocked ? "destructive" : "secondary"}
            className="tabular-nums"
          >
            {meter.remaining}/{meter.limit}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function UsageMeterCard() {
  const { status: authStatus } = useAuth();
  const [usage, setUsage] = React.useState<Usage | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Usage;
      setUsage(data);
    } catch {
      /* 네트워크 오류는 조용히 무시 — 다음 폴링에서 복구 */
    }
  }, []);

  // 인증 준비되면 최초 로드 + 30초 폴링 + 포커스/액션 시 즉시 갱신.
  React.useEffect(() => {
    if (authStatus !== "ready") return;
    void (async () => {
      await refresh();
    })();
    const poll = setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(USAGE_REFRESH_EVENT, refresh);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(USAGE_REFRESH_EVENT, refresh);
    };
  }, [authStatus, refresh]);

  // 카운트다운용 1초 틱(막힌 미터가 있을 때만 의미 있지만 단순화).
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  if (authStatus !== "ready" || !usage) return null;

  const isTrial = usage.tier === "trial";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="size-4" /> 사용량
          </CardTitle>
          <Badge variant={isTrial ? "outline" : "default"}>
            {isTrial ? "체험(오너 토큰)" : "개인 토큰"}
          </Badge>
        </div>
        <CardDescription>
          최근 2시간 기준 슬라이딩 한도. 쓴 시각에서 2시간 뒤 한 칸씩 회복돼요.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-border divide-y">
        <MeterRow
          title="수집·지표"
          hint="Meta 수집(무료). 지표 조회는 무제한."
          meter={usage.collect}
          now={now}
        />
        <MeterRow
          title="분석·비교"
          hint="AI 콘텐츠 분석 + 매장 비교(공용 풀)."
          meter={usage.llm}
          now={now}
        />
        {isTrial ? (
          <p className="text-muted-foreground pt-2 text-xs">
            개인 토큰을 연결하면 수집·지표가 무제한이 돼요. (분석·비교는 비용
            때문에 동일 한도 유지)
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
