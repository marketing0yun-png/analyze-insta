import "server-only";

import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto/token";
import { MetaApiError } from "@/lib/meta/client";
import { collectTrackedAccount } from "@/lib/meta/collect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** 토큰 복호화(node:crypto) → Node 런타임 강제. */
export const runtime = "nodejs";

const ACCOUNTS = "analyze_insta_tracked_accounts";
const CREDENTIALS = "analyze_insta_api_credentials";
const CHANNEL = "instagram";

/**
 * POST { id } — 분석 대상에 대해 Business Discovery 수집 1회 실행.
 * 소유권은 RLS 클라이언트로 검증한 뒤, 적재·토큰복호화는 service-role 로 처리.
 */
export async function POST(req: Request) {
  // 1) 세션 + 대상 소유권(RLS).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "세션이 없습니다. 익명 로그인 상태를 확인하세요." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "대상 id 가 필요합니다." }, { status: 400 });
  }

  const { data: account, error: accError } = await supabase
    .from(ACCOUNTS)
    .select("id, username")
    .eq("id", id)
    .maybeSingle();
  if (accError) {
    console.error("[api/accounts/collect] 대상 조회 오류:", accError.message);
    return NextResponse.json({ error: "대상을 조회하지 못했습니다." }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    // 2) 사용자 토큰 복호화(service-role — api_credentials 는 RLS 정책 없음).
    const admin = createAdminClient();
    const { data: cred, error: credError } = await admin
      .from(CREDENTIALS)
      .select("encrypted_token, ig_user_id")
      .eq("user_id", user.id)
      .eq("channel", CHANNEL)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (credError) throw credError;
    if (!cred?.ig_user_id) {
      return NextResponse.json(
        { error: "먼저 인스타 토큰을 연결하세요." },
        { status: 400 }
      );
    }

    const token = decryptToken(cred.encrypted_token as string);

    // 3) 수집 + 적재.
    const result = await collectTrackedAccount(
      admin,
      { id: account.id as string, username: account.username as string },
      token,
      cred.ig_user_id as string
    );

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    if (err instanceof MetaApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "서버 시크릿(SUPABASE_SERVICE_ROLE_KEY)이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    if (message.includes("TOKEN_ENCRYPTION_KEY")) {
      return NextResponse.json(
        { error: "토큰 암호화 키가 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    console.error("[api/accounts/collect] 수집 오류:", message);
    return NextResponse.json({ error: "수집 중 오류가 발생했습니다." }, { status: 500 });
  }
}
