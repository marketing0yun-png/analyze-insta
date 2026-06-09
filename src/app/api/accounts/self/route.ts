import "server-only";

import { NextResponse } from "next/server";

import { toPersonaCategory } from "@/lib/ai/personas";
import { decryptToken } from "@/lib/crypto/token";
import { MetaApiError, resolveInstagramUser } from "@/lib/meta/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** 토큰 복호화(node:crypto) → Node 런타임 강제. */
export const runtime = "nodejs";

const ACCOUNTS = "analyze_insta_tracked_accounts";
const CREDENTIALS = "analyze_insta_api_credentials";
const CHANNEL = "instagram";

/**
 * POST — 연결된 토큰의 **본인 계정**을 "내 계정"(owned + delegated)으로 등록 (Phase 3, D-023).
 * 토큰 주인 계정이어야 노출·도달 인사이트 호출이 안전하므로, username 은 저장값이 아니라
 * 토큰에서 재해석(resolveInstagramUser)해 ig_id 일치를 보장한다. 이미 있으면 기존 것 반환.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. 구글로 로그인한 뒤 다시 시도하세요." },
      { status: 401 }
    );
  }

  // 분석 페르소나 카테고리(D-028) — 내 계정도 카테고리를 가진다. 누락/오류는 'general'.
  const body = (await req.json().catch(() => null)) as {
    persona_category?: unknown;
  } | null;
  const personaCategory = toPersonaCategory(body?.persona_category);

  try {
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

    // 토큰에서 본인 username 재해석(api_credentials 에 username 컬럼이 없음).
    const token = decryptToken(cred.encrypted_token as string);
    const resolved = await resolveInstagramUser(token);
    const username = (resolved.username ?? "").trim().toLowerCase();
    if (!username) {
      return NextResponse.json(
        { error: "토큰에서 본인 계정 username 을 확인하지 못했습니다." },
        { status: 400 }
      );
    }

    // 이미 등록돼 있으면(외부로 잘못 등록 포함) 내 계정으로 승격해 반환.
    const { data: existing } = await supabase
      .from(ACCOUNTS)
      .select(
        "id, username, account_kind, access_tier, category_id, persona_category, ig_id, created_at"
      )
      .eq("username", username)
      .eq("channel", CHANNEL)
      .maybeSingle();

    if (existing) {
      if (
        existing.account_kind !== "owned" ||
        existing.access_tier !== "delegated"
      ) {
        const { data: promoted, error: upErr } = await supabase
          .from(ACCOUNTS)
          .update({
            account_kind: "owned",
            access_tier: "delegated",
            ig_id: cred.ig_user_id as string,
            persona_category: personaCategory,
          })
          .eq("id", existing.id as string)
          .select(
            "id, username, account_kind, access_tier, category_id, persona_category, ig_id, created_at"
          )
          .single();
        if (upErr) throw upErr;
        return NextResponse.json(
          { account: { ...promoted, latest_snapshot: null }, promoted: true },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { account: { ...existing, latest_snapshot: null }, existed: true },
        { status: 200 }
      );
    }

    const { data: inserted, error } = await supabase
      .from(ACCOUNTS)
      .insert({
        username,
        account_kind: "owned",
        access_tier: "delegated",
        ig_id: cred.ig_user_id as string,
        persona_category: personaCategory,
      })
      .select(
        "id, username, account_kind, access_tier, category_id, persona_category, ig_id, created_at"
      )
      .single();
    if (error) throw error;

    return NextResponse.json(
      { account: { ...inserted, latest_snapshot: null } },
      { status: 201 }
    );
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
    console.error("[api/accounts/self] 오류:", message);
    return NextResponse.json(
      { error: "내 계정 등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
