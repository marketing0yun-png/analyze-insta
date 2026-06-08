import type { AIResult, GenerateTextOptions } from "./types";

/**
 * AI 프로바이더 인터페이스. (D-016)
 * 새 모델을 붙이려면 이 인터페이스만 구현하면 된다 (예: providers/claude.ts).
 * 호출부는 항상 이 타입에만 의존한다.
 */
export interface AIProvider {
  /** 'gemini' | 'claude' … (로그·UI 표시용) */
  readonly name: string;
  /** 텍스트 생성/분석. */
  generateText(opts: GenerateTextOptions): Promise<AIResult>;
  /** 연결/자격증명 점검 — 짧은 응답 문자열 반환. */
  ping(): Promise<string>;
}
