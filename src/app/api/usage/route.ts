import "server-only";

import { NextResponse } from "next/server";

import { getAllMeters } from "@/lib/server/usage-meter";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** usage_events/credentials 조회는 service-role 필요 → Node 런타임. */
export const runtime = "nodejs";

/**
 * GET — 현재 사용자의 미터 상태(티어 + 수집·지표 / 분석·비교 잔여·리셋시각).
 * 카운트다운 UI 가 폴링한다. 읽기 전용 — 소비하지 않는다(D-024).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "세션이 없습니다." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const meters = await getAllMeters(admin, user.id);
    return NextResponse.json(meters, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "서버 시크릿(SUPABASE_SERVICE_ROLE_KEY)이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    console.error("[api/usage] 조회 오류:", message);
    return NextResponse.json(
      { error: "사용량을 조회하지 못했습니다." },
      { status: 500 }
    );
  }
}
