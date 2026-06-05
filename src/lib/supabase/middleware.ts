import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv, publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * 매 요청마다 Supabase 세션(익명/로그인) 토큰을 갱신하고 쿠키를 동기화한다.
 * 익명 로그인 자체는 클라이언트(AuthProvider)에서 1회 수행하고, 여기서는 유지/갱신만 담당.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // env 미설정(셋업 전)에는 세션 갱신을 건너뛰어 앱이 동작하도록 둔다.
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return supabaseResponse;
  }

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser()를 호출해야 만료 토큰이 갱신된다. (getSession은 신뢰 금지)
  await supabase.auth.getUser();

  return supabaseResponse;
}
