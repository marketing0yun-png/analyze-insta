/**
 * AI 분석 — **모델 중립 타입**. (Phase 2, D-016)
 * 어떤 프로바이더(Gemini/Claude…)를 써도 호출부·DB 적재·대시보드가
 * 이 타입에만 의존하도록 한다. 프로바이더 교체/사용자 선택의 핵심.
 */

/**
 * 멀티모달 이미지 입력 1장 — **인라인 바이트(base64)**. (D-022)
 * Vertex 의 Gemini 는 임의 HTTP URL 을 직접 fetch 하지 못하므로(gs:// 만 가능),
 * 호출부가 이미지 바이트를 받아 base64 로 넘긴다. 텍스트 전용 프로바이더는 무시.
 */
export type ImagePart = {
  /** MIME 타입 (image/jpeg, image/png, image/webp …). */
  mimeType: string;
  /** base64 로 인코딩된 이미지 바이트. */
  data: string;
};

export type GenerateTextOptions = {
  /** 시스템 지시(역할·규칙). */
  system?: string;
  /** 사용자 프롬프트(분석 대상 텍스트 등). */
  prompt: string;
  /**
   * 멀티모달 이미지 입력(선택). 프롬프트 텍스트 **뒤에 순서대로** 첨부된다. (D-022)
   * 프롬프트에서 "N번째 이미지"로 게시물과 연결한다. supportsVision=false 면 무시.
   */
  images?: ImagePart[];
  /** true 면 JSON 출력(application/json) 강제. 기본 false. */
  json?: boolean;
  /** 0~1. 기본은 프로바이더 기본값. */
  temperature?: number;
  /** 응답 최대 토큰. */
  maxOutputTokens?: number;
  /**
   * 추론(thinking) 토큰 예산. Gemini 2.5 계열은 기본적으로 thinking 이 켜져 있어
   * maxOutputTokens 가 작으면 출력이 비어버린다. 0=비활성, -1=동적(모델 자동),
   * 미지정=모델 기본값. (Claude 등 미지원 프로바이더는 무시)
   */
  thinkingBudget?: number;
};

/** 토큰 사용량 — 비용 모니터링용(레이트리밋 모니터링과 동일 사상). */
export type AIUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
};

export type AIResult = {
  text: string;
  usage: AIUsage;
  /** 실제 사용된 모델 식별자. */
  model: string;
};

/** 사용자에게 그대로 보여줄 수 있는 메시지를 담은 에러. */
export class AIError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
    readonly raw?: unknown
  ) {
    super(message);
    this.name = "AIError";
  }
}
