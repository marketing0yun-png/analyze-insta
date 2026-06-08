/**
 * AI 분석 — **모델 중립 타입**. (Phase 2, D-016)
 * 어떤 프로바이더(Gemini/Claude…)를 써도 호출부·DB 적재·대시보드가
 * 이 타입에만 의존하도록 한다. 프로바이더 교체/사용자 선택의 핵심.
 */

export type GenerateTextOptions = {
  /** 시스템 지시(역할·규칙). */
  system?: string;
  /** 사용자 프롬프트(분석 대상 텍스트 등). */
  prompt: string;
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
