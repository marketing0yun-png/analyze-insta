"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ContentInsights } from "@/components/accounts/content-insights";
import { EngagementMeter } from "@/components/accounts/engagement-badge";
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
import type { AccountMetrics } from "@/lib/analytics/account-metrics";

type DashboardTab = "metrics" | "insights";

type MetricsResponse = {
  account: {
    id: string;
    username: string;
    account_kind: "competitor" | "influencer" | "owned";
    access_tier: "public" | "delegated";
  };
  snapshot: {
    captured_at: string;
    followers_count: number | null;
    media_count: number | null;
    biography: string | null;
  } | null;
  collected_posts: number;
  metrics: AccountMetrics;
};

const FORMAT_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#ec4899", "#94a3b8"];
const BAR_COLOR = "#6366f1";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ko-KR");
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </div>
  );
}

export function AccountDashboard({ id }: { id: string }) {
  const { status: authStatus } = useAuth();
  const [data, setData] = React.useState<MetricsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<DashboardTab>("metrics");

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/accounts/metrics?id=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "불러오기 실패");
    return json as MetricsResponse;
  }, [id]);

  React.useEffect(() => {
    if (authStatus !== "ready") return;
    let active = true;
    (async () => {
      try {
        const json = await load();
        if (active) setData(json);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "오류");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus, load]);

  const backLink = (
    <Link
      href="/"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" /> 목록으로
    </Link>
  );

  if (authStatus !== "ready" || loading) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> 분석 불러오는 중…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="text-destructive border-destructive/30 rounded-md border p-3 text-sm">
          {error ?? "데이터가 없습니다."}
        </div>
      </div>
    );
  }

  const { account, snapshot, metrics, collected_posts } = data;
  const followers = snapshot?.followers_count ?? null;
  const noData = collected_posts === 0;

  return (
    <div className="space-y-5">
      {backLink}

      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            @{account.username}
          </h1>
          <Badge variant="secondary">
            {account.account_kind === "competitor"
              ? "경쟁사"
              : account.account_kind === "influencer"
                ? "인플루언서"
                : "위임"}
          </Badge>
        </div>
        {snapshot?.biography && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
            {snapshot.biography}
          </p>
        )}
      </header>

      {/* 탭: 공개지표 / AI 콘텐츠 인사이트 */}
      <div className="bg-muted/40 inline-flex gap-1 rounded-lg border p-1">
        <Button
          type="button"
          size="sm"
          variant={tab === "metrics" ? "default" : "ghost"}
          onClick={() => setTab("metrics")}
        >
          지표
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "insights" ? "default" : "ghost"}
          onClick={() => setTab("insights")}
        >
          콘텐츠 인사이트
        </Button>
      </div>

      {tab === "insights" ? (
        <ContentInsights id={id} />
      ) : noData ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            아직 수집된 게시물이 없습니다. 목록에서 <RefreshCw className="inline size-3" />{" "}
            수집을 먼저 실행하세요.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 요약 통계 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="팔로워" value={fmt(followers)} />
            <StatCard
              label="참여율"
              value={
                metrics.engagementRate != null
                  ? `${metrics.engagementRate}%`
                  : "—"
              }
              sub="(좋아요+댓글)/팔로워"
            />
            <StatCard
              label="주당 업로드"
              value={
                metrics.postsPerWeek != null ? `${metrics.postsPerWeek}회` : "—"
              }
              sub={
                metrics.avgIntervalHours != null
                  ? `평균 ${metrics.avgIntervalHours}h 간격`
                  : undefined
              }
            />
            <StatCard
              label="분석 게시물"
              value={`${metrics.analyzedPosts}개`}
              sub={`최근 ${collected_posts}개 기준`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="평균 좋아요" value={fmt(metrics.avgLikes)} />
            <StatCard label="평균 댓글" value={fmt(metrics.avgComments)} />
            <StatCard label="게시물 총수" value={fmt(snapshot?.media_count)} />
            <StatCard
              label="수집 시각"
              value={
                snapshot?.captured_at
                  ? new Date(snapshot.captured_at).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"
              }
            />
          </div>

          {/* 참여율 등급 (규모 보정) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">참여율 등급</CardTitle>
              <CardDescription>
                팔로워 규모 대비 기대치(눈금)와 비교한 참여율. 비즈니스·대형
                계정은 평균이 낮은 게 정상이라 규모별로 다르게 평가합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EngagementMeter
                rate={metrics.engagementRate}
                followers={followers}
              />
            </CardContent>
          </Card>

          {/* 포맷 비중 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">포맷 비중</CardTitle>
              <CardDescription>최근 게시물의 콘텐츠 형식 분포.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={metrics.formats}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {metrics.formats.map((f, i) => (
                        <Cell
                          key={f.kind}
                          fill={FORMAT_COLORS[i % FORMAT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value}개`, String(name)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="w-full space-y-1 text-sm sm:w-44">
                  {metrics.formats.map((f, i) => (
                    <li
                      key={f.kind}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              FORMAT_COLORS[i % FORMAT_COLORS.length],
                          }}
                        />
                        {f.label}
                      </span>
                      <span className="text-muted-foreground">
                        {f.count}개 ({f.pct}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* 업로드 시간대 (KST) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">업로드 시간대 (KST)</CardTitle>
              <CardDescription>시간대별 게시 빈도. 활동 패턴 파악.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={metrics.byHour}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10 }}
                    interval={2}
                    tickFormatter={(h: number) => `${h}`}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => [`${value}개`, "게시물"]}
                    labelFormatter={(h) => `${h}시대`}
                  />
                  <Bar dataKey="count" fill={BAR_COLOR} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 업로드 요일 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">업로드 요일 (KST)</CardTitle>
              <CardDescription>요일별 게시 빈도.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={metrics.byWeekday}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => [`${value}개`, "게시물"]}
                    labelFormatter={(l) => `${l}요일`}
                  />
                  <Bar dataKey="count" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 상위 게시물 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">참여 상위 게시물</CardTitle>
              <CardDescription>좋아요+댓글 기준 상위 5개.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics.topPosts.map((p, i) => (
                <div
                  key={p.externalMediaId}
                  className="flex items-start gap-3 rounded-md border p-2.5 text-sm"
                >
                  <span className="text-muted-foreground w-4 shrink-0 font-mono">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs">
                      {p.caption?.trim() || (
                        <span className="text-muted-foreground italic">
                          (캡션 없음)
                        </span>
                      )}
                    </p>
                    <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Heart className="size-3" /> {fmt(p.likeCount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="size-3" /> {fmt(p.commentsCount)}
                      </span>
                      {p.postedAt && (
                        <span>
                          {new Date(p.postedAt).toLocaleDateString("ko-KR", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  {p.permalink && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="게시물 열기"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Users className="size-3" /> 외부 공개지표 기준 — 노출·도달은 포함되지
            않습니다.
          </p>
        </>
      )}
    </div>
  );
}
