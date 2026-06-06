import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv, getServiceRoleKey } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * service-role 클라이언트 — **RLS 우회**. 마스터 콘솔/수집 잡/토큰 복호화 등
 * 서버 전용 경로에서만 사용한다. 절대 클라이언트로 노출 금지(server-only 가드).
 */
export function createAdminClient() {
  const { supabaseUrl } = getPublicEnv();
  const supabaseServiceRoleKey = getServiceRoleKey();

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
