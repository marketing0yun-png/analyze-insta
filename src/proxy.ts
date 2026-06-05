import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 "proxy" 컨벤션 (구 middleware). 매 요청 Supabase 세션 갱신.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로에서 세션 갱신:
     * - _next/static, _next/image (정적 자산)
     * - favicon, 이미지/아이콘 파일
     * - manifest, service worker
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
