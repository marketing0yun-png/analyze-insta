/**
 * Supabase 스키마 타입 placeholder.
 * 실제 타입은 마이그레이션 적용 후 아래로 생성·교체한다:
 *   supabase gen types typescript --linked > src/lib/supabase/types.ts
 * (또는 MCP generate_typescript_types)
 *
 * 생성 전까지는 느슨한 타입으로 빌드만 통과시킨다.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
