"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Check,
  Hash,
  Loader2,
  Plus,
  ShieldCheck,
  Users,
  X,
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

type Usage = {
  collect2h: number;
  collect24h: number;
  llm2h: number;
  llm24h: number;
};
type Accounts = {
  owned: number;
  competitor: number;
  influencer: number;
  other: number;
};
type Request = {
  id: string;
  user_id: string;
  keyword: string;
  status: string;
  note: string | null;
  requested_at: string;
};
type Curated = {
  id: string;
  hashtag: string;
  note: string | null;
  created_at: string;
};
type MasterData = {
  users: number;
  personalTokens: number;
  usage: Usage;
  accounts: Accounts;
  requests: Request[];
  curated: Curated[];
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function MasterPage() {
  const { status: authStatus } = useAuth();
  const [data, setData] = React.useState<MasterData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [newHashtag, setNewHashtag] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const res = await fetch("/api/master", { cache: "no-store" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "조회 실패");
      setData(null);
      return;
    }
    setError(null);
    setData((await res.json()) as MasterData);
  }, []);

  React.useEffect(() => {
    if (authStatus !== "ready") return;
    void (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [authStatus, refresh]);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) await refresh();
      else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "처리 실패");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link href="/">
            <ArrowLeft /> 홈
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="size-6" /> 마스터 콘솔
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          전 사용자 조합 뷰(service-role). 사용량·계정·해시태그 신청을 관리합니다.
          접근 권한은 환경변수(MASTER_EMAILS / MASTER_USER_IDS)로 통제됩니다.
        </p>
      </header>

      {authStatus !== "ready" || loading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> 불러오는 중…
        </p>
      ) : error ? (
        <Card>
          <CardContent className="text-destructive p-4 text-sm">{error}</CardContent>
        </Card>
      ) : data ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4" /> 사용량 (최근 2시간 / 24시간)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="수집 2h" value={data.usage.collect2h} />
              <Stat label="수집 24h" value={data.usage.collect24h} />
              <Stat label="분석·비교 2h" value={data.usage.llm2h} />
              <Stat label="분석·비교 24h" value={data.usage.llm24h} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> 사용자 · 계정
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Stat label="가입 사용자" value={data.users} />
              <Stat label="개인 토큰" value={data.personalTokens} />
              <Stat label="내 계정" value={data.accounts.owned} />
              <Stat label="경쟁사" value={data.accounts.competitor} />
              <Stat label="인플루언서" value={data.accounts.influencer} />
              <Stat label="기타" value={data.accounts.other} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Hash className="size-4" /> 해시태그 신청 대기 ({data.requests.length})
              </CardTitle>
              <CardDescription>
                체험 유저의 신청을 직접 검색(주 30개 쿼터 내)한 뒤 처리하세요.
                ‘처리+큐레이션’은 키워드를 공통 목록에도 올립니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.requests.length === 0 ? (
                <p className="text-muted-foreground text-xs">대기 중인 신청이 없습니다.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {data.requests.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 p-2.5"
                    >
                      <span className="font-medium">#{r.keyword}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            post({ action: "fulfill_request", id: r.id, addCurated: true })
                          }
                        >
                          <Check /> 처리+큐레이션
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => post({ action: "reject_request", id: r.id })}
                          aria-label="반려"
                        >
                          <X />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">큐레이션 해시태그 ({data.curated.length})</CardTitle>
              <CardDescription>모든 사용자에게 공통 노출되는 추천 해시태그.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newHashtag.trim()) return;
                  void post({ action: "add_curated", hashtag: newHashtag }).then(() =>
                    setNewHashtag("")
                  );
                }}
              >
                <div className="relative flex-1">
                  <Hash className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <Input
                    placeholder="육아, 신생아 등"
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                    disabled={busy}
                    className="pl-7"
                  />
                </div>
                <Button type="submit" disabled={busy || !newHashtag.trim()}>
                  <Plus /> 추가
                </Button>
              </form>
              {data.curated.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {data.curated.map((c) => (
                    <Badge key={c.id} variant="outline" className="font-normal">
                      #{c.hashtag}
                    </Badge>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
