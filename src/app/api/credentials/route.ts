import "server-only";

import { NextResponse } from "next/server";

import { encryptToken } from "@/lib/crypto/token";
import {
  MetaApiError,
  exchangeLongLivedToken,
  resolveInstagramUser,
} from "@/lib/meta/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** crypto(node:crypto) 사용 → Edge 아닌 Node 런타임 강제. */
export const runtime = "nodejs";

const CHANNEL = "instagram";
const TABLE = "analyze_insta_api_credentials";

/** 현재 (익명/로그인) 세션의 user_id. 없으면 null. */
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * GET — 현재 사용자의 인스타 토큰 연결 상태.
 * 토큰 평문/암호문은 절대 반환하지 않는다 (ig_user_id·만료시각만).
 */
export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return NextResponse.json(
        { connected: false, reason: "unauthenticated" },
        { status: 200 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from(TABLE)
      .select("ig_user_id, token_expires_at, created_at")
      .eq("user_id", userId)
      .eq("channel", CHANNEL)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ connected: false }, { status: 200 });

    return NextResponse.json(
      {
        connected: true,
        ig_user_id: data.ig_user_id,
        token_expires_at: data.token_expires_at,
        connected_at: data.created_at,
      },
      { status: 200 }
    );
  } catch (err) {
    return serverErrorResponse(err);
  }
}

/**
 * POST { token } — Meta 토큰 검증 → ig_user_id 추출 → 장기토큰 교환 → 암호화 저장.
 * 응답에 토큰을 포함하지 않는다.
 */
export async function POST(req: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "로그인이 필요합니다. 구글로 로그인한 뒤 다시 시도하세요." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json(
        { error: "토큰을 입력하세요." },
        { status: 400 }
      );
    }

    // 1) 토큰 검증 + ig_user_id 추출
    const resolved = await resolveInstagramUser(token);

    // 2) 장기 토큰 교환 (앱 시크릿 있을 때만; 없으면 원본 유지)
    const longLived = await exchangeLongLivedToken(token);

    // 3) 암호화 저장 (api_credentials 는 RLS 정책 없음 → service-role 만 접근)
    const admin = createAdminClient();
    // 채널당 1개 유지: 기존 자격증명 교체
    const { error: delError } = await admin
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("channel", CHANNEL);
    if (delError) throw delError;

    const { error: insError } = await admin.from(TABLE).insert({
      user_id: userId,
      channel: CHANNEL,
      ig_user_id: resolved.igUserId,
      encrypted_token: encryptToken(longLived.token),
      token_expires_at: longLived.expiresAt,
    });
    if (insError) throw insError;

    return NextResponse.json(
      {
        ok: true,
        ig_user_id: resolved.igUserId,
        username: resolved.username,
        page_name: resolved.pageName,
        candidate_count: resolved.candidateCount,
        token_expires_at: longLived.expiresAt,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof MetaApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return serverErrorResponse(err);
  }
}

/** 환경변수 미설정(서버 시크릿) 등 서버 측 오류를 사용자 친화적으로 변환. */
function serverErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return NextResponse.json(
      {
        error:
          "서버 시크릿(SUPABASE_SERVICE_ROLE_KEY)이 설정되지 않았습니다. .env.local 을 확인하세요.",
      },
      { status: 503 }
    );
  }
  if (message.includes("TOKEN_ENCRYPTION_KEY")) {
    return NextResponse.json(
      { error: "토큰 암호화 키가 설정되지 않았습니다. .env.local 을 확인하세요." },
      { status: 503 }
    );
  }
  console.error("[api/credentials] 서버 오류:", message);
  return NextResponse.json(
    { error: "서버 오류가 발생했습니다." },
    { status: 500 }
  );
}
