import "server-only";

import type { User } from "@supabase/supabase-js";

import { getMasterEmails, getMasterUserIds } from "@/lib/env";

/**
 * 마스터(프로젝트 오너) 식별 (Phase 3 · D-025) — **서버 전용.**
 * 마스터는 service-role 로 전 사용자 과거기록을 조합·재가공하는 콘솔(/master)에 접근한다.
 *
 * 식별 = env 화이트리스트(MASTER_EMAILS 또는 MASTER_USER_IDS) 일치.
 *  - 구글 로그인 후엔 이메일이 1순위(안정적).
 *  - 익명인증 단계엔 이메일이 없으므로 user_id(UUID)로도 지정 가능(임시).
 * 둘 다 비어 있으면 누구도 마스터가 아니다(안전 기본값).
 */
export function isMaster(user: User | null | undefined): boolean {
  if (!user) return false;
  const emails = getMasterEmails();
  const ids = getMasterUserIds();
  if (emails.length === 0 && ids.length === 0) return false;

  const email = (user.email ?? "").trim().toLowerCase();
  if (email && emails.includes(email)) return true;
  if (ids.includes(user.id.toLowerCase())) return true;
  return false;
}
