import "server-only";

import { getAIProviderName } from "@/lib/env";

import type { AIProvider } from "./provider";
import { GeminiProvider } from "./providers/gemini";

export type { AIProvider } from "./provider";
export { AIError } from "./types";
export type { AIResult, GenerateTextOptions } from "./types";

let cached: AIProvider | null = null;

/**
 * 활성 AI 프로바이더 반환. (D-016)
 * AI_PROVIDER env 로 선택 — 현재 'gemini'(Vertex AI). 향후 'claude' 추가 시
 * 여기 switch 한 줄만 늘리면 된다. 정식 단계의 "사용자별 선택"도 이 함수를
 * 인자(providerName)로 받게 확장하면 된다.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const name = getAIProviderName();
  switch (name) {
    case "gemini":
      cached = new GeminiProvider();
      break;
  }
  return cached;
}
