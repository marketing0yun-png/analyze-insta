import "server-only";

import { getAIProvider } from ".";
import { OBJECTIVITY_RULES, type CompareSummary } from "./compare-accounts";
import { getPersona, type PersonaCategory } from "./personas";
import { AIError } from "./types";
import { gradeEngagement } from "@/lib/analytics/engagement-benchmark";

/**
 * 단일 계정 **전략 진단** (Phase 2.5 후속) — 서버 전용.
 * 비교 대상 없이 계정 1개의 지표·콘텐츠 인사이트를 받아 강점/약점/개선책/콘텐츠
 * 아이디어를 LLM 으로 낸다. 비교군이 없으므로 **절대 등급 기준**으로만 평가한다
 * (compare-accounts 의 OBJECTIVITY_RULES 공유 — 상대평가·환각 방지).
 *
 * 결과는 reports(kind='diagnosis')에 적재. UI 는 account-dashboard '전략 진단' 탭.
 */

/** 모델 중립 단일 진단 — UI·DB 적재가 이 타입에만 의존. */
export type AccountDiagnosis = {
  /** 분석 게시물로 추론한 카테고리·방향성(한 줄). 콘텐츠 아이디어의 근거. */
  category: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  contentIdeas: string[];
  model: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
};

/** 카테고리 페르소나를 주입한 단일 진단 시스템 지시. */
function buildSystemInstruction(category: PersonaCategory): string {
  const persona = getPersona(category);
  return [
    `당신은 ${persona.roleNoun}의 SNS 마케팅 전략가입니다.`,
    persona.domainContext,
    "인스타그램 계정 **하나**의 공개지표·콘텐츠 전략을 위 카테고리 맥락에서 보고 **냉정하고 솔직한** 진단을 내립니다.",
    "비교 대상이 없으므로 다른 계정과 견주지 말고 **이 계정의 절대 등급**만으로 평가하세요.",
    "'노출/도달'은 '내 계정'으로 표시될 때만 주어집니다 — 주어지지 않으면 추정·언급하지 마세요.",
    "참여율은 **규모(팔로워) 대비 등급**으로 판단하세요(큰 계정은 구조적으로 낮음).",
    OBJECTIVITY_RULES,
    "분석에서 끝내지 말고 **무엇을 더 시도해야 할지(구체 콘텐츠 아이디어)** 까지 제시하세요.",
    "모든 값은 한국어로, 지정된 JSON 스키마만 출력합니다(코드펜스·설명 금지).",
  ].join(" ");
}

function fmt(n: number | null): string {
  return n == null ? "N/A" : String(n);
}

function buildPrompt(s: CompareSummary): string {
  const grade = gradeEngagement(s.engagementRate, s.followers);
  const formats =
    s.topFormats.map((f) => `${f.label} ${f.pct}%`).join(", ") || "N/A";
  const appeal =
    s.appealPoints.map((a) => `${a.label}(${a.count})`).join(", ") || "N/A";
  const tones = s.tones.map((t) => `${t.label}(${t.count})`).join(", ") || "N/A";
  const keywords = s.keywords.map((k) => k.label).join(", ") || "N/A";
  const isOwned = s.kind === "owned";
  const insightLine =
    s.avgReach != null || s.avgImpressions != null
      ? `- 노출·도달(내 계정 전용): 평균 도달 ${fmt(s.avgReach)} / 평균 노출 ${fmt(s.avgImpressions)}`
      : isOwned
        ? "- 노출·도달(내 계정): 미수집"
        : "- 노출·도달: 없음(외부 계정 — 추정 금지)";

  const block = [
    `## @${s.username} (유형: ${isOwned ? "내 계정" : s.kind})`,
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

  return [
    "다음 한 계정을 절대 등급 기준으로 냉정하게 진단하세요.",
    "",
    block,
    "",
    "아래 JSON 객체로만 응답하세요.",
    "{",
    '  "category": "분석 게시물로 추론한 이 계정의 카테고리·방향성(한 줄)",',
    '  "strengths": ["강점(절대 등급 기준, 빈약하면 빈 배열)", "..."],',
    '  "weaknesses": ["약점(구체적으로)", "..."],',
    '  "recommendations": ["개선책(이 매장 기준 객관·현실적, 수치 날조 금지)", "..."],',
    '  "contentIdeas": ["category 기준 인스타에서 잘 통하는 포맷·소재의 실행형 아이디어", "..."]',
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

/** 단일 계정 전략 진단 실행. summary 1개를 받아 LLM 평가를 낸다. */
export async function diagnoseAccount(
  summary: CompareSummary
): Promise<AccountDiagnosis> {
  const provider = getAIProvider();
  const res = await provider.generateText({
    system: buildSystemInstruction(summary.personaCategory),
    prompt: buildPrompt(summary),
    json: true,
    temperature: 0.3,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(res.text));
  } catch {
    throw new AIError(
      "전략 진단 응답을 JSON 으로 해석하지 못했습니다.",
      502,
      res.text.slice(0, 500)
    );
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;

  return {
    category: asString(obj.category),
    strengths: asStringArray(obj.strengths),
    weaknesses: asStringArray(obj.weaknesses),
    recommendations: asStringArray(obj.recommendations),
    contentIdeas: asStringArray(obj.contentIdeas),
    model: res.model,
    usage: res.usage,
  };
}
