import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * 서버 컴포넌트 / route handler 용 Supabase 클라이언트 (사용자 컨텍스트, RLS 적용).
 * 쿠키를 통해 익명/로그인 세션을 그대로 사용한다.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // 서버 컴포넌트에서 호출되면 set이 무시될 수 있다 (미들웨어가 세션 갱신을 담당).
        }
      },
    },
  });
}
