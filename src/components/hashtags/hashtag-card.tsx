"use client";

import * as React from "react";
import {
  ExternalLink,
  Hash,
  Heart,
  Loader2,
  MessageCircle,
  Search,
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

type Quota = {
  used: number;
  limit: number;
  remaining: number;
  recentHashtags: string[];
};

type Job = {
  id: string;
  hashtag: string;
  requested_at: string;
  status: string;
  result_count: number;
};

type ResultMedia = {
  id: string;
  caption: string | null;
  like_count: number | null;
  comments_count: number | null;
  media_type: string | null;
  permalink: string | null;
  timestamp: string | null;
};

type RunResult = {
  hashtag: string;
  results: ResultMedia[];
  quota: Quota;
  reusedQuota: boolean;
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ko-KR");
}

export function HashtagCard() {
  const { status: authStatus } = useAuth();
  const [keyword, setKeyword] = React.useState("");
  const [quota, setQuota] = React.useState<Quota | null>(null);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<RunResult | null>(null);

  const fetchState = React.useCallback(async () => {
    const res = await fetch("/api/hashtags", { cache: "no-store" });
    return (await res.json()) as { quota: Quota | null; jobs: Job[] };
  }, []);

  React.useEffect(() => {
    if (authStatus !== "ready") return;
    let active = true;
    (async () => {
      try {
        const data = await fetchState();
        if (active) {
          setQuota(data.quota);
          setJobs(data.jobs ?? []);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus, fetchState]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    setSearching(true);
    try {
      const res = await fetch("/api/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "검색 실패");
      } else {
        const r = data.result as RunResult;
        setResults(r);
        setQuota(r.quota);
        setKeyword("");
        // 이력 갱신
        const refreshed = await fetchState();
        setJobs(refreshed.jobs ?? []);
      }
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setSearching(false);
    }
  }

  const lowQuota = quota != null && quota.remaining <= 5;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Hash className="size-4" /> 해시태그 검색
          </CardTitle>
          {quota && (
            <Badge
              variant={lowQuota ? "destructive" : "secondary"}
              className={lowQuota ? "" : "font-mono"}
            >
              {quota.used}/{quota.limit} 사용
            </Badge>
          )}
        </div>
        <CardDescription>
          인기 게시물을 조회합니다. <strong>토큰당 7일에 30개 고유 태그</strong>{" "}
          하드 쿼터가 있어 신중히 사용하세요. (작성자·조회수는 제공 안 됨)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {authStatus !== "ready" ? (
          <p className="text-muted-foreground">
            세션이 준비된 뒤 사용할 수 있습니다.
          </p>
        ) : (
          <>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Hash className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  placeholder="육아, 신생아 등"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  disabled={searching}
                  className="pl-7"
                />
              </div>
              <Button type="submit" disabled={searching || !keyword.trim()}>
                {searching ? (
                  <>
                    <Loader2 className="animate-spin" /> 검색 중…
                  </>
                ) : (
                  <>
                    <Search /> 검색
                  </>
                )}
              </Button>
            </form>

            {quota && (
              <p className="text-muted-foreground text-xs">
                이번 7일 잔여 {quota.remaining}개.{" "}
                {quota.recentHashtags.length > 0 && (
                  <>이미 조회: {quota.recentHashtags.map((h) => `#${h}`).join(" ")}</>
                )}
              </p>
            )}

            {error && (
              <div className="text-destructive border-destructive/30 rounded-md border p-3">
                {error}
              </div>
            )}

            {results && (
              <div className="space-y-2">
                <p className="font-medium">
                  #{results.hashtag} 인기 게시물 {results.results.length}개
                  {results.reusedQuota && (
                    <span className="text-muted-foreground ml-1 text-xs font-normal">
                      (7일 내 재조회 — 쿼터 미소비)
                    </span>
                  )}
                </p>
                {results.results.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    결과가 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {results.results.slice(0, 10).map((m) => (
                      <li
                        key={m.id}
                        className="flex items-start gap-3 rounded-md border p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs">
                            {m.caption?.trim() || (
                              <span className="text-muted-foreground italic">
                                (캡션 없음)
                              </span>
                            )}
                          </p>
                          <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1">
                              <Heart className="size-3" /> {fmt(m.like_count)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="size-3" />{" "}
                              {fmt(m.comments_count)}
                            </span>
                          </div>
                        </div>
                        {m.permalink && (
                          <a
                            href={m.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            aria-label="게시물 열기"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {loading ? (
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="size-3 animate-spin" /> 쿼터 확인 중…
              </p>
            ) : (
              jobs.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground mb-2 text-xs">최근 조회</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {jobs.map((j) => (
                      <Badge key={j.id} variant="outline" className="font-normal">
                        #{j.hashtag}
                        <span className="text-muted-foreground ml-1">
                          {j.result_count}
                        </span>
                      </Badge>
                    ))}
                  </ul>
                </div>
              )
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
