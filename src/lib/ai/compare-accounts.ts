import "server-only";

import { getAIProvider } from ".";
import { AIError } from "./types";
import { gradeEngagement } from "@/lib/analytics/engagement-benchmark";
import type { AccountReport } from "@/lib/server/account-report";

/**
 * 계정 비교 + LLM **냉정 평가** (Phase 2.5, D-021) — 서버 전용.
 * 둘 이상의 계정 집계(지표 + 콘텐츠 인사이트)를 받아 모델 중립 JSON 평가를 만든다.
 * "왜 잘/못 나가는가 · 약점 · 개선책"을 신랄하게. 결과는 reports(kind='comparison')에 적재.
 *
 * ⚠️ 외부 계정은 공개지표만 — 노출·도달은 비교에 없다(있는 척 평가하지 않게 프롬프트로 고정).
 */

/** 비교 입력용 1계정 요약(프롬프트·정량표 공용). */
export type CompareSummary = {
  username: string;
  kind: "competitor" | "influencer" | "owned";
  /** 사용자가 '벤치마크(따라잡을 목표)'로 지정했는지. 나머지는 '개선 대상'. */
  isBenchmark: boolean;
  followers: number | null;
  engagementRate: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  postsPerWeek: number | null;
  analyzedPosts: number;
  /** 내 계정(delegated)만 — 노출·도달 평균. 외부는 null(D-023). */
  avgReach: number | null;
  avgImpressions: number | null;
  topFormats: { label: string; pct: number }[];
  appealPoints: { label: string; count: number }[];
  tones: { label: string; count: number }[];
  keywords: { label: string; count: number }[];
};

/** 모델 중립 비교 평가 — UI·DB 적재가 이 타입에만 의존. */
export type AccountVerdict = {
  username: string;
  /** 참여율 자동 순위(1=상위). */
  rank: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  /** 이 매장이 당장 시도해볼 구체 콘텐츠 아이디어(실행형). */
  contentIdeas: string[];
};

export type ComparisonReport = {
  /** 한 줄 총평(신랄하게). */
  summary: string;
  /** 차원별 핵심 차이(참여율·소구점·포맷·업로드 등). */
  keyDifferences: string[];
  /** 비교 전반에서 발견된 기회·다음 액션(분석에서 끝내지 않기). */
  opportunities: string[];
  accounts: AccountVerdict[];
  model: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
};

/** AccountReport → 비교용 요약(프롬프트 토큰 절약 + 정량표 공용). */
export function summarizeForCompare(
  report: AccountReport,
  isBenchmark = false
): CompareSummary {
  const m = report.metrics;
  const ins = report.insights;
  const isOwned = report.account.access_tier === "delegated";
  return {
    username: report.account.username,
    kind: report.account.account_kind,
    isBenchmark,
    followers: report.followers,
    engagementRate: m.engagementRate,
    avgLikes: m.avgLikes,
    avgComments: m.avgComments,
    postsPerWeek: m.postsPerWeek,
    analyzedPosts: ins.analyzedPosts,
    // 노출·도달은 내 계정만 — 외부엔 없음(추정 금지를 위해 null 고정).
    avgReach: isOwned ? m.avgReach : null,
    avgImpressions: isOwned ? m.avgImpressions : null,
    topFormats: m.formats.slice(0, 3).map((f) => ({ label: f.label, pct: f.pct })),
    appealPoints: ins.appealPoints.slice(0, 6),
    tones: ins.tones.slice(0, 4),
    keywords: ins.keywords.slice(0, 8),
  };
}

/** 참여율 내림차순 순위. 참여율 null 은 맨 뒤(동률은 평균반응으로 보조). */
export function rankByEngagement(summaries: CompareSummary[]): CompareSummary[] {
  return [...summaries].sort((a, b) => {
    const ea = a.engagementRate ?? -1;
    const eb = b.engagementRate ?? -1;
    if (eb !== ea) return eb - ea;
    const ra = (a.avgLikes ?? 0) + (a.avgComments ?? 0);
    const rb = (b.avgLikes ?? 0) + (b.avgComments ?? 0);
    return rb - ra;
  });
}

const SYSTEM_INSTRUCTION = [
  "당신은 한국 육아용품 매장의 SNS 마케팅 전략가입니다.",
  "여러 인스타그램 계정의 공개지표·콘텐츠 전략을 비교해 **냉정하고 솔직한** 진단을 내립니다.",
  "근거 없는 칭찬은 금지하고, 약점과 개선책을 구체적으로 지적합니다.",
  "'노출/도달'은 '내 계정'으로 표시된 계정에만 주어집니다 — 주어지지 않은(외부) 계정엔 추정·언급하지 마세요.",
  "참여율은 **규모(팔로워) 대비 등급**으로 판단하세요. 큰 계정은 참여율이 구조적으로 낮으니,",
  "절대 수치만 보고 '낮다'고 단정하지 말고 각 계정에 주어진 등급(활발/양호/평균/다소 낮음)을 존중하세요.",
  "분석에서 끝내지 말고 **무엇을 더 시도해야 할지(구체 콘텐츠 아이디어·다음 액션)** 까지 제시하세요.",
  "모든 값은 한국어로, 지정된 JSON 스키마만 출력합니다(코드펜스·설명 금지).",
].join(" ");

function fmt(n: number | null): string {
  return n == null ? "N/A" : String(n);
}

function serialize(s: CompareSummary, rank: number, hasBenchmark: boolean): string {
  const formats = s.topFormats.map((f) => `${f.label} ${f.pct}%`).join(", ") || "N/A";
  const appeal = s.appealPoints.map((a) => `${a.label}(${a.count})`).join(", ") || "N/A";
  const tones = s.tones.map((t) => `${t.label}(${t.count})`).join(", ") || "N/A";
  const keywords = s.keywords.map((k) => k.label).join(", ") || "N/A";
  const grade = gradeEngagement(s.engagementRate, s.followers);
  const role = hasBenchmark
    ? s.isBenchmark
      ? ", 역할: 벤치마크 목표"
      : ", 역할: 개선 대상"
    : "";
  const isOwned = s.kind === "owned";
  const insightLine =
    s.avgReach != null || s.avgImpressions != null
      ? `- 노출·도달(내 계정 전용): 평균 도달 ${fmt(s.avgReach)} / 평균 노출 ${fmt(s.avgImpressions)}`
      : isOwned
        ? "- 노출·도달(내 계정): 미수집"
        : "- 노출·도달: 없음(외부 계정 — 추정 금지)";
  return [
    `## @${s.username} (참여율 순위 ${rank}위, 유형: ${isOwned ? "내 계정" : s.kind}${role})`,
    `- 팔로워: ${fmt(s.followers)}`,
    `- 참여율: ${fmt(s.engagementRate)}% → 등급 "${grade.label}" (${grade.followersBand} 규모 기대치 ${grade.benchmark}%)`,
    `- 평균 좋아요/댓글: ${fmt(s.avgLikes)} / ${fmt(s.avgComments)}`,
    insightLine,
    `- 주당 업로드: ${fmt(s.postsPerWeek)}`,
    `- 분석 게시물 수: ${s.analyzedPosts}`,
    `- 주요 포맷: ${formats}`,
    `- 소구점: ${appeal}`,
    `- 카피 톤: ${tones}`,
    `- 키워드: ${keywords}`,
  ].join("\n");
}

function buildPrompt(ranked: CompareSummary[]): string {
  const hasBenchmark = ranked.some((s) => s.isBenchmark);
  const blocks = ranked.map((s, i) => serialize(s, i + 1, hasBenchmark));
  const benchmarkGuide = hasBenchmark
    ? [
        "사용자가 일부 매장을 '벤치마크 목표'로 지정했습니다.",
        "벤치마크 목표를 **따라잡아야 할 기준**으로 삼고, '개선 대상' 매장이 그 수준에 도달하려면",
        "무엇을 바꿔야 하는지에 집중하세요. opportunities·각 개선 대상의 recommendations·contentIdeas 는",
        "벤치마크가 잘하는데 개선 대상이 놓치는 지점을 좁히는 방향으로 구체화하세요.",
        "(벤치마크 목표 매장 자체에는 유지·강화 관점의 평가를 간단히.)",
        "",
      ].join("\n")
    : "";
  return [
    "다음 계정들을 비교해 냉정하게 평가하세요. 순위는 참여율(규모 보정 등급) 기준으로 이미 매겨져 있습니다.",
    "",
    benchmarkGuide,
    blocks.join("\n\n"),
    "",
    "아래 JSON 객체로만 응답하세요. accounts 는 위 계정 전부를 포함합니다.",
    "{",
    '  "summary": "전체 비교 한 줄 총평(신랄하게)",',
    '  "keyDifferences": ["계정 간 핵심 차이(참여율 등급/소구점/포맷/업로드 관점)", "..."],',
    '  "opportunities": ["비교에서 드러난 기회·다음 액션(상위 계정이 하고 하위가 안 하는 것 등, 실행형)", "..."],',
    '  "accounts": [',
    "    {",
    '      "username": "계정명(@ 없이)",',
    '      "strengths": ["강점", "..."],',
    '      "weaknesses": ["약점(구체적으로)", "..."],',
    '      "recommendations": ["개선책(실행 가능하게)", "..."],',
    '      "contentIdeas": ["당장 시도할 구체 콘텐츠 아이디어(포맷·소재까지)", "..."]',
    "    }",
    "  ]",
    "}",
  ].join("\n");
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asString).filter((s) => s.length > 0);
}
function stripFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return t;
}

/**
 * 비교 평가 실행. 입력은 2개 이상 권장(1개면 의미 없음).
 * 순위는 참여율 기준으로 매긴 뒤 LLM 에 넘기고, 평가 결과를 순위와 병합한다.
 */
export async function compareAccounts(
  summaries: CompareSummary[]
): Promise<ComparisonReport> {
  const ranked = rankByEngagement(summaries);
  const rankByUser = new Map(ranked.map((s, i) => [s.username, i + 1]));

  const provider = getAIProvider();
  const res = await provider.generateText({
    system: SYSTEM_INSTRUCTION,
    prompt: buildPrompt(ranked),
    json: true,
    temperature: 0.3,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(res.text));
  } catch {
    throw new AIError("비교 평가 응답을 JSON 으로 해석하지 못했습니다.", 502, res.text.slice(0, 500));
  }
  const obj = (parsed ?? {}) as {
    summary?: unknown;
    keyDifferences?: unknown;
    opportunities?: unknown;
    accounts?: unknown;
  };

  const rawAccounts = Array.isArray(obj.accounts) ? obj.accounts : [];
  const verdictByUser = new Map<string, AccountVerdict>();
  for (const raw of rawAccounts) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const username = asString(item.username).replace(/^@/, "");
    if (!rankByUser.has(username) || verdictByUser.has(username)) continue;
    verdictByUser.set(username, {
      username,
      rank: rankByUser.get(username)!,
      strengths: asStringArray(item.strengths),
      weaknesses: asStringArray(item.weaknesses),
      recommendations: asStringArray(item.recommendations),
      contentIdeas: asStringArray(item.contentIdeas),
    });
  }

  // 모델이 누락한 계정도 순위만이라도 채워 빈 평가로 노출(전체 일관성).
  for (const s of ranked) {
    if (!verdictByUser.has(s.username)) {
      verdictByUser.set(s.username, {
        username: s.username,
        rank: rankByUser.get(s.username)!,
        strengths: [],
        weaknesses: [],
        recommendations: [],
        contentIdeas: [],
      });
    }
  }

  const accounts = [...verdictByUser.values()].sort((a, b) => a.rank - b.rank);

  return {
    summary: asString(obj.summary),
    keyDifferences: asStringArray(obj.keyDifferences),
    opportunities: asStringArray(obj.opportunities),
    accounts,
    model: res.model,
    usage: res.usage,
  };
}
