"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  Clock,
  LineChart,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Sparkles,
  Trash2,
  UserCircle,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  ANALYZE_CHUNK,
  SEC_PER_CHUNK,
  analyzeAccountLooped,
} from "@/lib/client/analyze-loop";
import { USAGE_REFRESH_EVENT } from "@/components/usage/usage-meter-card";
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
  insightsCollected?: number;
};

/** 외부(공개지표) vs 내 계정(노출·도달까지). UI 라벨은 "내 계정/외부"로 통일(D-023). */
const KIND_LABEL: Record<Account["account_kind"], string> = {
  competitor: "경쟁사",
  influencer: "인플루언서",
  owned: "내 계정",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 계정당 대략 소요(수집 + 분석 최대 3청크). ETA 안내·표시용(D-023). */
const SEC_PER_ACCOUNT = 110;

function fmtNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ko-KR");
}

function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}분 ${rem}초` : `${m}분`;
}

/** 일괄 처리 진행 상태(분석중 배너용). */
type BatchProgress = {
  index: number; // 1-based 현재 계정
  total: number; // 선택 총 계정 수
  username: string;
  phase: "collect" | "analyze";
  postDone: number;
  postTotal: number;
};

/** 남은 예상 시간(초) — 남은 계정 + 현재 계정 진행도 기준의 러프 추정. */
function estimateRemainingSec(p: BatchProgress): number {
  const accountsAfter = p.total - p.index; // 아직 시작 안 한 계정
  let current = SEC_PER_ACCOUNT;
  if (p.phase === "analyze") {
    const left = Math.max(0, p.postTotal - p.postDone);
    current = Math.ceil(left / ANALYZE_CHUNK) * SEC_PER_CHUNK;
  }
  return accountsAfter * SEC_PER_ACCOUNT + current;
}

export function AccountsCard() {
  const { status: authStatus } = useAuth();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [username, setUsername] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [kind, setKind] = React.useState<"competitor" | "influencer">(
    "competitor"
  );
  const [adding, setAdding] = React.useState(false);
  const [addingSelf, setAddingSelf] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  // 일괄 처리
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [force, setForce] = React.useState(false);
  const [batchRunning, setBatchRunning] = React.useState(false);
  const [progress, setProgress] = React.useState<BatchProgress | null>(null);

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

  function setNote(id: string, msg: string) {
    setNotes((n) => ({ ...n, [id]: msg }));
  }

  function applyCollectResult(id: string, r: CollectResult) {
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

  /** 연결된 토큰의 본인 계정을 "내 계정"으로 등록(노출·도달 분석 대상). */
  async function handleAddSelf() {
    setError(null);
    setAddingSelf(true);
    try {
      const res = await fetch("/api/accounts/self", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "내 계정 등록에 실패했습니다.");
      } else {
        const acc = data.account as Account;
        setAccounts((prev) => {
          const rest = prev.filter((a) => a.id !== acc.id);
          return [acc, ...rest];
        });
        setNote(
          acc.id,
          data.existed
            ? "이미 내 계정으로 등록돼 있습니다."
            : "내 계정 등록 완료 — '수집'으로 노출·도달까지 가져오세요."
        );
      }
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setAddingSelf(false);
    }
  }

  /** 단건 수집(+분석 없이). 일괄과 별개로 개별 수집 버튼 유지. */
  async function handleCollect(id: string) {
    setError(null);
    setBusyId(id);
    setNote(id, "수집 중…");
    try {
      const res = await fetch("/api/accounts/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(id, data.error ?? "수집 실패");
      } else {
        const r = data.result as CollectResult;
        applyCollectResult(id, r);
        setNote(
          id,
          data.cached
            ? "캐시됨 (오늘 이미 수집)"
            : `수집 완료 · 게시물 ${r.collectedPosts}개` +
                (r.insightsCollected
                  ? ` · 인사이트 ${r.insightsCollected}개`
                  : "")
        );
      }
    } catch {
      setNote(id, "수집 중 오류");
    } finally {
      setBusyId(null);
      // 미터 카드 즉시 갱신(수집 1회 소비 반영).
      window.dispatchEvent(new Event(USAGE_REFRESH_EVENT));
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
        setSelected((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const allSelected =
    accounts.length > 0 && selected.size === accounts.length;

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(accounts.map((a) => a.id)));
  }

  /**
   * 선택 계정을 순차로 수집 → 분석. 분석은 청크 반복 호출(60초/요청 한도 회피, D-023).
   * 계정 사이 0.5s 딜레이로 레이트리밋 완화. 진행률은 분석중 배너로 표시.
   */
  async function runBatch() {
    const targets = accounts.filter((a) => selected.has(a.id));
    if (targets.length === 0) return;

    // 시작 전 안내(미리 인지) — 계정당 약 100~120초.
    const est = fmtDuration(targets.length * SEC_PER_ACCOUNT);
    const ok = window.confirm(
      `선택한 ${targets.length}개 계정을 수집하고 AI 분석합니다.\n` +
        `계정당 약 100~120초 소요 — 예상 총 약 ${est}.\n` +
        `분석할 계정 수를 줄이면 소요 시간도 줄어듭니다.\n\n` +
        `분석이 끝날 때까지 이 탭을 열어두세요. 진행할까요?`
    );
    if (!ok) return;

    setError(null);
    setBatchRunning(true);
    try {
      let idx = 0;
      for (const acc of targets) {
        idx += 1;
        const id = acc.id;
        setProgress({
          index: idx,
          total: targets.length,
          username: acc.username,
          phase: "collect",
          postDone: 0,
          postTotal: 0,
        });
        setNote(id, "수집 중…");

        let collectedLabel = "";
        try {
          const cRes = await fetch("/api/accounts/collect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, force }),
          });
          const cData = await cRes.json();
          if (!cRes.ok) {
            setNote(id, `수집 실패: ${cData.error ?? ""}`);
            await sleep(500);
            continue;
          }
          const r = cData.result as CollectResult;
          applyCollectResult(id, r);
          collectedLabel = cData.cached
            ? "캐시됨"
            : `수집 ${r.collectedPosts}개` +
              (r.insightsCollected ? `·인사이트 ${r.insightsCollected}` : "");
        } catch {
          setNote(id, "수집 중 오류");
          await sleep(500);
          continue;
        }

        // 분석 — 청크 반복 호출. 진행률(N/M) 갱신.
        setProgress((p) =>
          p ? { ...p, phase: "analyze", postDone: 0, postTotal: 0 } : p
        );
        setNote(id, `${collectedLabel} · 분석 준비…`);
        const ar = await analyzeAccountLooped(id, {
          reanalyze: force,
          onProgress: ({ done, total }) => {
            setProgress((p) =>
              p ? { ...p, phase: "analyze", postDone: done, postTotal: total } : p
            );
            setNote(
              id,
              total > 0
                ? `${collectedLabel} · 분석 ${done}/${total}`
                : `${collectedLabel} · 분석 중…`
            );
          },
        });
        if (ar.error) {
          setNote(id, `${collectedLabel} · 분석 실패: ${ar.error}`);
        } else {
          setNote(
            id,
            `${collectedLabel} · 분석 ${ar.analyzed}개 완료` +
              (ar.alreadyAnalyzed ? ` (기존 ${ar.alreadyAnalyzed}개)` : "")
          );
        }
        // 계정 1건 끝날 때마다 미터 갱신(수집·분석 소비분 반영).
        window.dispatchEvent(new Event(USAGE_REFRESH_EVENT));
        await sleep(500);
      }
    } finally {
      setBatchRunning(false);
      setProgress(null);
      window.dispatchEvent(new Event(USAGE_REFRESH_EVENT));
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
          <strong>외부 계정</strong>(경쟁사·인플루언서)은 공개지표만,{" "}
          <strong>내 계정</strong>은 노출·도달까지 분석합니다. 개인계정은 불가.
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
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as "competitor" | "influencer")
                  }
                  disabled={adding}
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  aria-label="계정 유형"
                >
                  <option value="competitor">경쟁사</option>
                  <option value="influencer">인플루언서</option>
                </select>
                <Button type="submit" disabled={adding || !username.trim()}>
                  {adding ? (
                    <>
                      <Loader2 className="animate-spin" /> 등록 중…
                    </>
                  ) : (
                    <>
                      <Plus /> 외부 계정 추가
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSelf}
                  disabled={addingSelf}
                  title="연결된 토큰의 본인 계정을 노출·도달 분석 대상으로 등록"
                >
                  {addingSelf ? (
                    <>
                      <Loader2 className="animate-spin" /> 추가 중…
                    </>
                  ) : (
                    <>
                      <UserCircle /> 내 계정 분석 추가
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

            {/* 일괄 처리 바 */}
            {accounts.length > 0 && (
              <div className="bg-muted/40 space-y-2 rounded-md border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={batchRunning}
                      className="size-4"
                    />
                    전체선택
                  </label>
                  <span className="text-muted-foreground text-xs">
                    {selected.size}개 선택
                  </span>
                  <label className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={force}
                      onChange={(e) => setForce(e.target.checked)}
                      disabled={batchRunning}
                      className="size-3.5"
                    />
                    강제 갱신(캐시 무시)
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={runBatch}
                    disabled={batchRunning || selected.size === 0}
                  >
                    {batchRunning ? (
                      <>
                        <Loader2 className="animate-spin" /> 처리 중…
                      </>
                    ) : (
                      <>
                        <Sparkles /> 선택 수집 &amp; 분석
                      </>
                    )}
                  </Button>
                </div>
                {selected.size > 0 && !batchRunning && (
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Clock className="size-3" /> 예상 약{" "}
                    {fmtDuration(selected.size * SEC_PER_ACCOUNT)} (계정당 약
                    100~120초) · 분석 중 탭을 닫지 마세요.
                  </p>
                )}
              </div>
            )}

            {/* 분석 중 배너 — 진행률 + 예상 남은 시간 */}
            {batchRunning && progress && (
              <div className="border-primary/40 bg-primary/5 space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="text-primary size-4 animate-spin" /> 분석 중…
                  계정 {progress.index}/{progress.total}
                </div>
                <p className="text-muted-foreground text-xs">
                  @{progress.username} —{" "}
                  {progress.phase === "collect"
                    ? "수집 중…"
                    : progress.postTotal > 0
                      ? `분석 ${progress.postDone}/${progress.postTotal}개`
                      : "분석 준비 중…"}
                </p>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{
                      width: `${
                        ((progress.index -
                          1 +
                          (progress.postTotal > 0
                            ? progress.postDone / progress.postTotal
                            : 0)) /
                          progress.total) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  예상 약 {fmtDuration(estimateRemainingSec(progress))} 남음 · 탭을
                  닫지 마세요.
                </p>
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
                  const isOwned = a.account_kind === "owned";
                  return (
                    <li key={a.id} className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selected.has(a.id)}
                            onChange={() => toggleSelect(a.id)}
                            disabled={batchRunning}
                            className="mt-1 size-4 shrink-0"
                            aria-label={`${a.username} 선택`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">
                                @{a.username}
                              </span>
                              <Badge
                                variant={isOwned ? "default" : "secondary"}
                                className={
                                  isOwned
                                    ? "shrink-0 bg-emerald-600 text-white"
                                    : "shrink-0"
                                }
                              >
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
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCollect(a.id)}
                            disabled={busy || batchRunning}
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
                            disabled={busy || batchRunning}
                            aria-label="삭제"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      {notes[a.id] && (
                        <p className="text-muted-foreground pl-6 text-xs">
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
