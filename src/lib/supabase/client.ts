import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 * anon key만 사용한다. Meta 토큰 등 시크릿은 절대 여기로 흐르지 않는다.
 */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
