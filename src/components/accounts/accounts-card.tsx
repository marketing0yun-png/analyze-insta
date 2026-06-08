"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  LineChart,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
  Users,
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

type Snapshot = {
  captured_at: string;
  followers_count: number | null;
  media_count: number | null;
};

type Account = {
  id: string;
  username: string;
  account_kind: "competitor" | "influencer" | "owned";
  access_tier: "public" | "delegated";
  category_id: string | null;
  ig_id: string | null;
  created_at: string;
  latest_snapshot: Snapshot | null;
};

type CollectResult = {
  username: string;
  followersCount: number | null;
  mediaCount: number | null;
  collectedPosts: number;
  capturedAt: string;
};

const KIND_LABEL: Record<Account["account_kind"], string> = {
  competitor: "경쟁사",
  influencer: "인플루언서",
  owned: "위임",
};

function fmtNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ko-KR");
}

export function AccountsCard() {
  const { status: authStatus } = useAuth();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [username, setUsername] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [kind, setKind] = React.useState<Account["account_kind"]>("competitor");
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  const fetchAccounts = React.useCallback(async (): Promise<Account[]> => {
    const res = await fetch("/api/accounts", { cache: "no-store" });
    const data = await res.json();
    return (data.accounts ?? []) as Account[];
  }, []);

  React.useEffect(() => {
    if (authStatus !== "ready") return;
    let active = true;
    (async () => {
      try {
        const list = await fetchAccounts();
        if (active) setAccounts(list);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus, fetchAccounts]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          account_kind: kind,
          category_name: category.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
      } else {
        setAccounts((prev) => [data.account as Account, ...prev]);
        setUsername("");
        setCategory("");
      }
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setAdding(false);
    }
  }

  async function handleCollect(id: string) {
    setError(null);
    setBusyId(id);
    setNotes((n) => ({ ...n, [id]: "" }));
    try {
      const res = await fetch("/api/accounts/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotes((n) => ({ ...n, [id]: data.error ?? "수집 실패" }));
      } else {
        const r = data.result as CollectResult;
        setNotes((n) => ({
          ...n,
          [id]: `수집 완료 · 게시물 ${r.collectedPosts}개`,
        }));
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  latest_snapshot: {
                    captured_at: r.capturedAt,
                    followers_count: r.followersCount,
                    media_count: r.mediaCount,
                  },
                }
              : a
          )
        );
      }
    } catch {
      setNotes((n) => ({ ...n, [id]: "수집 중 오류" }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/accounts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-4" /> 분석 대상 계정
          </CardTitle>
          {accounts.length >= 2 && (
            <Button asChild variant="outline" size="sm">
              <Link href="/compare">
                <Scale /> 비교 분석
              </Link>
            </Button>
          )}
        </div>
        <CardDescription>
          외부 비즈니스/크리에이터 계정의 <strong>username</strong>을 등록하고
          공개지표(팔로워·좋아요·댓글수)를 수집합니다. 개인계정·노출/도달은 불가.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {authStatus !== "ready" ? (
          <p className="text-muted-foreground">
            세션이 준비된 뒤 사용할 수 있습니다. (위 익명 인증 상태 확인)
          </p>
        ) : (
          <>
            <form onSubmit={handleAdd} className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="username (예: instagram)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={adding}
                  className="sm:flex-1"
                />
                <Input
                  placeholder="카테고리(선택)"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={adding}
                  className="sm:w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as Account["account_kind"])
                  }
                  disabled={adding}
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  aria-label="계정 유형"
                >
                  <option value="competitor">경쟁사</option>
                  <option value="influencer">인플루언서</option>
                  <option value="owned">위임</option>
                </select>
                <Button type="submit" disabled={adding || !username.trim()}>
                  {adding ? (
                    <>
                      <Loader2 className="animate-spin" /> 등록 중…
                    </>
                  ) : (
                    <>
                      <Plus /> 추가
                    </>
                  )}
                </Button>
              </div>
            </form>

            {error && (
              <div className="text-destructive border-destructive/30 rounded-md border p-3">
                {error}
              </div>
            )}

            {loading ? (
              <p className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> 불러오는 중…
              </p>
            ) : accounts.length === 0 ? (
              <p className="text-muted-foreground">
                아직 등록된 분석 대상이 없습니다. username 을 추가해 보세요.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {accounts.map((a) => {
                  const busy = busyId === a.id;
                  const snap = a.latest_snapshot;
                  return (
                    <li key={a.id} className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              @{a.username}
                            </span>
                            <Badge variant="secondary" className="shrink-0">
                              {KIND_LABEL[a.account_kind]}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1">
                              <Users className="size-3" />
                              {fmtNumber(snap?.followers_count)}
                            </span>
                            <span>게시물 {fmtNumber(snap?.media_count)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCollect(a.id)}
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <RefreshCw />
                            )}
                            수집
                          </Button>
                          {a.latest_snapshot && (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/accounts/${a.id}`} aria-label="분석">
                                <LineChart /> 분석
                              </Link>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(a.id)}
                            disabled={busy}
                            aria-label="삭제"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      {notes[a.id] && (
                        <p className="text-muted-foreground text-xs">
                          {notes[a.id]}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
