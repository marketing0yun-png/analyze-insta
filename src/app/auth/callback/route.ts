import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * 구글 OAuth 콜백(D-026) — PKCE code 를 세션으로 교환하고 쿠키에 심는다.
 * Supabase 대시보드 redirect URL 에 `<origin>/auth/callback` 이 등록돼 있어야 한다.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
}
