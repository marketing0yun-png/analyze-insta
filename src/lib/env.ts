/**
 * 환경변수 접근 헬퍼.
 * - `NEXT_PUBLIC_*` 만 클라이언트 번들에 포함된다.
 * - service-role / Meta 시크릿은 절대 여기(클라이언트 경로)에서 읽지 않는다.
 *   서버 전용 값은 `serverEnv()`로만 접근하고, 서버 모듈에서만 호출한다.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[env] 필수 환경변수 누락: ${name}. .env.local 을 확인하세요 (docs/08_SETUP.md §5).`
    );
  }
  return value;
}

/** 클라이언트/서버 공용 (공개 가능, RLS 전제) */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export function getPublicEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", publicEnv.supabaseUrl),
    supabaseAnonKey: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      publicEnv.supabaseAnonKey
    ),
  };
}

/**
 * 서버 전용 시크릿. **서버 컴포넌트/route/Edge 에서만** 호출할 것.
 * 클라이언트 컴포넌트에서 import 하면 빌드가 깨지도록 server-only 가드를 둔다.
 */
export function getServerEnv() {
  return {
    supabaseServiceRoleKey: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    metaAppId: required("META_APP_ID", process.env.META_APP_ID),
    metaAppSecret: required("META_APP_SECRET", process.env.META_APP_SECRET),
    tokenEncryptionKey: required(
      "TOKEN_ENCRYPTION_KEY",
      process.env.TOKEN_ENCRYPTION_KEY
    ),
  };
}
