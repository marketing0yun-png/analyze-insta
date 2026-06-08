import "server-only";

import { GoogleGenAI, type Part } from "@google/genai";

import { getVertexConfig } from "@/lib/env";

import type { AIProvider } from "../provider";
import { AIError, type AIResult, type GenerateTextOptions } from "../types";

/**
 * Gemini 프로바이더 — **Vertex AI 경유, 서버 전용.** (Phase 2, D-016)
 * 인증은 서비스계정(ADC 파일 경로 또는 인라인 JSON) — getVertexConfig() 참조.
 * 자격증명/모델/리전은 절대 클라이언트로 노출하지 않는다.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly supportsVision = true;

  private clientAndConfig() {
    const { project, location, model, maxOutputTokens, credentials } =
      getVertexConfig();
    const client = new GoogleGenAI({
      vertexai: true,
      project,
      location,
      // 인라인 자격증명이 있으면 사용, 없으면 GOOGLE_APPLICATION_CREDENTIALS(ADC).
      googleAuthOptions: credentials ? { credentials } : undefined,
    });
    return { client, model, maxOutputTokens };
  }

  async generateText(opts: GenerateTextOptions): Promise<AIResult> {
    const { client, model, maxOutputTokens } = this.clientAndConfig();

    // 이미지가 있으면 멀티모달 contents(텍스트 + 인라인 이미지 파트)로, 없으면 문자열로. (D-022)
    const contents =
      opts.images && opts.images.length > 0
        ? [
            {
              role: "user",
              parts: [
                { text: opts.prompt },
                ...opts.images.map(
                  (img): Part => ({
                    inlineData: { mimeType: img.mimeType, data: img.data },
                  })
                ),
              ],
            },
          ]
        : opts.prompt;

    let res;
    try {
      res = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature,
          // 호출별 지정값 > env 기본(미설정 시 모델 최대 65536).
          maxOutputTokens: opts.maxOutputTokens ?? maxOutputTokens,
          ...(opts.thinkingBudget !== undefined
            ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } }
            : {}),
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      });
    } catch (err) {
      throw new AIError(
        "Gemini(Vertex AI) 호출에 실패했습니다. 자격증명/프로젝트/리전 설정을 확인하세요.",
        502,
        err
      );
    }

    const text = res.text ?? "";
    const u = res.usageMetadata;
    return {
      text,
      model,
      usage: {
        inputTokens: u?.promptTokenCount ?? null,
        outputTokens: u?.candidatesTokenCount ?? null,
      },
    };
  }

  async ping(): Promise<string> {
    const { text } = await this.generateText({
      prompt: "한 단어로만 답하세요: OK",
      maxOutputTokens: 32,
      temperature: 0,
      thinkingBudget: 0, // 점검용 — thinking 비활성으로 작은 출력 보장.
    });
    return text.trim();
  }
}
