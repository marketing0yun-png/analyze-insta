import "server-only";

import { NextResponse } from "next/server";

import { AIError, getAIProvider } from "@/lib/ai";
import { getVertexConfig } from "@/lib/env";

/** google-auth-library 사용 → Node 런타임 강제. */
export const runtime = "nodejs";

/**
 * GET /api/ai/ping — AI 프로바이더(현재 Gemini/Vertex) 연결·자격증명 점검용.
 * 개발/설정 검증 전용. 자격증명 자체는 절대 응답에 포함하지 않는다(project/model/리전만).
 */
export async function GET() {
  try {
    const provider = getAIProvider();
    const cfg = getVertexConfig();
    const reply = await provider.ping();

    return NextResponse.json(
      {
        ok: true,
        provider: provider.name,
        project: cfg.project,
        location: cfg.location,
        model: cfg.model,
        reply,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
    // env 미설정(자격증명/프로젝트)은 친절히 그대로 노출(시크릿 값은 아님).
    if (message.startsWith("[env]")) {
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
    console.error("[api/ai/ping] 서버 오류:", message);
    return NextResponse.json(
      { ok: false, error: "AI 점검 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
