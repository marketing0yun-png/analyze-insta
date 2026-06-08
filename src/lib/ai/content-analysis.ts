import "server-only";

import { getAIProvider } from ".";
import { AIError } from "./types";

/**
 * 콘텐츠 분석 파이프라인 (Phase 2, D-019) — **서버 전용**.
 * 수집된 게시물(캡션 + 포맷 + 참여지표)을 AI 프로바이더에 넘겨
 * **모델 중립 JSON 스키마**(주제·소구점·포맷·카피톤·키워드)로 분석한다.
 * 호출부(DB 적재)·대시보드는 이 모듈의 타입에만 의존하므로 모델을 바꿔도 호환된다.
 *
 * 도메인: 광고주가 육아용품 매장 → 경쟁/인플루언서 인스타 콘텐츠의
 * "어떤 내용/소구점이 반응이 좋은가"를 뽑는 데 초점.
 *
 * ⚠️ 캡션은 텍스트만 분석한다(프로바이더 인터페이스 = generateText, 텍스트 전용).
 *    이미지 비전 분석은 추상화 확장이 필요 → 후속(멀티모달 provider) 과제.
 */

export type PostForAnalysis = {
  externalMediaId: string;
  caption: string | null;
  mediaType: "image" | "video" | "carousel" | "reel" | null;
  likeCount: number | null;
  commentsCount: number | null;
  postedAt: string | null;
};

/** 모델 중립 콘텐츠 분석 결과. content_analysis 적재·대시보드가 이 타입에만 의존. */
export type ContentAnalysis = {
  externalMediaId: string;
  /** 한 줄 주제. */
  topic: string;
  /** 소구점(구매 동기·강조점) 목록. */
  appealPoints: string[];
  /** 콘텐츠 구성/포맷(예: "정보형 캐러셀", "후기형 릴스"). */
  format: string;
  /** 카피 톤(예: "친근/공감", "전문/신뢰"). */
  tone: string;
  /** 한 줄 요약. */
  summary: string;
  /** 키워드(해시태그성 핵심어). */
  keywords: string[];
};

export type AnalyzeContentResult = {
  results: ContentAnalysis[];
  model: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
};

/** 한 번의 호출에 묶을 게시물 수. 출력 누락·토큰 폭주를 막기 위해 청크 처리. */
const CHUNK_SIZE = 10;

const SYSTEM_INSTRUCTION = [
  "당신은 한국 육아용품 매장의 SNS 마케팅 분석가입니다.",
  "주어진 인스타그램 게시물(캡션·포맷·참여지표)을 분석해 마케팅 인사이트를 추출합니다.",
  "광고주가 '어떤 주제·소구점의 콘텐츠가 반응이 좋은지' 파악하도록 돕는 것이 목표입니다.",
  "모든 결과 값은 한국어로, 간결하고 구체적으로 작성합니다.",
  "반드시 지정된 JSON 스키마만 출력하고, 그 외 설명·코드펜스는 출력하지 않습니다.",
].join(" ");

/** 게시물 1건을 프롬프트용 텍스트 블록으로 직렬화. */
function serializePost(p: PostForAnalysis): string {
  const caption = (p.caption ?? "").trim() || "(캡션 없음)";
  const fmt = p.mediaType ?? "unknown";
  const like = p.likeCount ?? "?";
  const cmt = p.commentsCount ?? "?";
  return [
    `[id] ${p.externalMediaId}`,
    `[포맷] ${fmt}`,
    `[참여] 좋아요 ${like} · 댓글 ${cmt}`,
    `[캡션] ${caption}`,
  ].join("\n");
}

function buildPrompt(posts: PostForAnalysis[]): string {
  const blocks = posts.map((p, i) => `### 게시물 ${i + 1}\n${serializePost(p)}`);
  return [
    "다음 인스타그램 게시물들을 각각 분석하세요.",
    "",
    blocks.join("\n\n"),
    "",
    "각 게시물에 대해 아래 객체를 만들어 JSON 배열로만 응답하세요.",
    "스키마(각 항목):",
    "{",
    '  "id": "입력의 [id] 값을 그대로",',
    '  "topic": "한 줄 주제",',
    '  "appealPoints": ["소구점", "..."],',
    '  "format": "콘텐츠 구성/포맷(예: 정보형 캐러셀, 후기형 릴스)",',
    '  "tone": "카피 톤(예: 친근/공감, 전문/신뢰)",',
    '  "summary": "한 줄 요약",',
    '  "keywords": ["핵심어", "..."]',
    "}",
    "응답은 위 객체들의 JSON 배열이어야 합니다. 입력 게시물 수와 동일한 길이로 반환하세요.",
  ].join("\n");
}

type RawItem = {
  id?: unknown;
  topic?: unknown;
  appealPoints?: unknown;
  format?: unknown;
  tone?: unknown;
  summary?: unknown;
  keywords?: unknown;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asString(x)).filter((s) => s.length > 0);
}

/** json 모드라도 모델이 펜스를 붙이는 경우를 방어적으로 벗겨낸다. */
function stripFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return t;
}

function parseChunk(
  text: string,
  chunk: PostForAnalysis[]
): ContentAnalysis[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new AIError("AI 응답을 JSON 으로 해석하지 못했습니다.", 502, text.slice(0, 500));
  }
  // 배열 또는 { results: [...] } 형태 모두 수용.
  const arr: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { results?: unknown }).results)
      ? ((parsed as { results: unknown[] }).results)
      : [];

  const validIds = new Set(chunk.map((p) => p.externalMediaId));
  const byId = new Map<string, ContentAnalysis>();

  arr.forEach((raw, i) => {
    const item = (raw ?? {}) as RawItem;
    // id 가 유효하면 그대로, 아니면 순서로 매칭(모델이 id 를 누락/변형하는 경우 대비).
    const rawId = asString(item.id);
    const id = validIds.has(rawId) ? rawId : chunk[i]?.externalMediaId;
    if (!id || byId.has(id)) return;
    byId.set(id, {
      externalMediaId: id,
      topic: asString(item.topic),
      appealPoints: asStringArray(item.appealPoints),
      format: asString(item.format),
      tone: asString(item.tone),
      summary: asString(item.summary),
      keywords: asStringArray(item.keywords),
    });
  });

  return [...byId.values()];
}

/**
 * 게시물 묶음을 분석한다. 청크(10개)로 나눠 순차 호출 — 출력 누락·토큰 폭주 방지.
 * 입력이 비면 빈 결과. 캡션이 전부 빈 게시물도 분석은 시도(포맷/참여 기반).
 */
export async function analyzeContent(
  posts: PostForAnalysis[]
): Promise<AnalyzeContentResult> {
  const provider = getAIProvider();
  const results: ContentAnalysis[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let model = provider.name;

  for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
    const chunk = posts.slice(i, i + CHUNK_SIZE);
    const res = await provider.generateText({
      system: SYSTEM_INSTRUCTION,
      prompt: buildPrompt(chunk),
      json: true,
      temperature: 0.2,
    });
    model = res.model;
    if (res.usage.inputTokens) inputTokens += res.usage.inputTokens;
    if (res.usage.outputTokens) outputTokens += res.usage.outputTokens;
    results.push(...parseChunk(res.text, chunk));
  }

  return {
    results,
    model,
    usage: {
      inputTokens: inputTokens || null,
      outputTokens: outputTokens || null,
    },
  };
}
