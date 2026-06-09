"use client";

import Link from "next/link";
import {
  BarChart3,
  Gauge,
  Infinity as InfinityIcon,
  LineChart,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_ACCOUNTS, DEMO_USAGE } from "@/lib/demo/demo-data";

const KIND_LABEL = {
  owned: "내 계정",
  competitor: "경쟁사",
  influencer: "인플루언서",
} as const;

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

/**
 * 데모(로그아웃) 홈 미리보기(D-026) — 고정 목업으로 제품을 보여준다.
 * 모든 조작은 비활성. 내 계정 데모만 상세 대시보드(/accounts/demo)로 진입 가능.
 */
export function DemoHome() {
  return (
    <>
      <div className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-medium">데모 모드 — 둘러보기</p>
        <p className="mt-0.5 text-xs">
          아래는 <strong>미리 정해진 예시 데이터</strong>예요. 기능이 어떻게
          보이는지 구경만 할 수 있어요. 내 인스타 계정을 실제로 분석하려면 위에서
          구글로 로그인하세요.
        </p>
      </div>

      {/* 사용량 미터 미리보기 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="size-4" /> 사용량{" "}
              <Badge variant="outline" className="ml-1">
                예시
              </Badge>
            </CardTitle>
            <Badge variant="outline">체험(오너 토큰)</Badge>
          </div>
          <CardDescription>
            최근 2시간 기준 슬라이딩 한도. 개인 토큰을 연결하면 수집·지표가
            무제한이 돼요.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border divide-y">
          <div className="flex items-center justify-between py-1.5">
            <div>
              <p className="text-sm font-medium">수집·지표</p>
              <p className="text-muted-foreground text-xs">
                Meta 수집(무료). 지표 조회는 무제한.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {DEMO_USAGE.collect.remaining}/{DEMO_USAGE.collect.limit}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <div>
              <p className="text-sm font-medium">분석·비교</p>
              <p className="text-muted-foreground text-xs">
                AI 콘텐츠 분석 + 매장 비교(공용 풀).
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {DEMO_USAGE.llm.remaining}/{DEMO_USAGE.llm.limit}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 분석 대상 계정 미리보기 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4" /> 분석 대상 계정{" "}
            <Badge variant="outline" className="ml-1">
              예시
            </Badge>
          </CardTitle>
          <CardDescription>
            <strong>외부 계정</strong>(경쟁사·인플루언서)은 공개지표만,{" "}
            <strong>내 계정</strong>은 노출·도달까지 분석해요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {DEMO_ACCOUNTS.map((a) => {
              const isOwned = a.account_kind === "owned";
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">@{a.username}</span>
                      <Badge
                        variant={isOwned ? "default" : "secondary"}
                        className={
                          isOwned ? "bg-emerald-600 text-white" : undefined
                        }
                      >
                        {KIND_LABEL[a.account_kind]}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Users className="size-3" /> {fmt(a.followers)}
                      </span>
                      <span>게시물 {fmt(a.media)}</span>
                    </div>
                  </div>
                  {a.hasDashboard ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/accounts/${a.id}`}>
                        <LineChart /> 예시 분석 보기
                      </Link>
                    </Button>
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      로그인 후
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            👉 <strong>@demo_baby_store</strong>의 “예시 분석 보기”를 누르면
            노출·도달까지 포함한 대시보드 예시를 볼 수 있어요.
          </p>
        </CardContent>
      </Card>

      {/* 개인 토큰 = 무제한 안내 */}
      <Card>
        <CardContent className="text-muted-foreground flex items-start gap-2 py-4 text-xs">
          <InfinityIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            구글 로그인 후 내 Meta(인스타) 토큰을 연결하면 수집·지표가 무제한이
            되고, 내 계정의 노출·도달까지 분석할 수 있어요.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
