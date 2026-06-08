import "server-only";

import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto/token";
import { MetaApiError } from "@/lib/meta/client";
import { collectOwnedAccount, collectTrackedAccount } from "@/lib/meta/collect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getMeterStatus,
  meterBlockedMessage,
  recordUsage,
} from "@/lib/server/usage-meter";

/** 토큰 복호화(node:crypto) → Node 런타임 강제. */
export const runtime = "nodejs";
/** 내 계정은 게시물별 인사이트 호출이 많아 여유를 둔다(외부는 짧음). */
export const maxDuration = 60;

const ACCOUNTS = "analyze_insta_tracked_accounts";
const SNAPSHOTS = "analyze_insta_account_snapshots";
const CREDENTIALS = "analyze_insta_api_credentials";
const CHANNEL = "instagram";

/** KST(UTC+9) 기준 오늘 0시의 UTC epoch(ms). 일일 캐시 신선도 판정(D-023). */
function startOfTodayKstMs(): number {
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
  return (
    Date.UTC(
      nowKst.getUTCFullYear(),
      nowKst.getUTCMonth(),
      nowKst.getUTCDate()
    ) -
    9 * 3600 * 1000
  );
}

/**
 * POST { id } — 분석 대상에 대해 Business Discovery 수집 1회 실행.
 * 소유권은 RLS 클라이언트로 검증한 뒤, 적재·토큰복호화는 service-role 로 처리.
 */
export async function POST(req: Request) {
  // 1) 세션 + 대상 소유권(RLS).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "세션이 없습니다. 익명 로그인 상태를 확인하세요." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { id?: unknown; force?: unknown }
    | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const force = body?.force === true;
  if (!id) {
    return NextResponse.json({ error: "대상 id 가 필요합니다." }, { status: 400 });
  }

  const { data: account, error: accError } = await supabase
    .from(ACCOUNTS)
    .select("id, username, access_tier")
    .eq("id", id)
    .maybeSingle();
  if (accError) {
    console.error("[api/accounts/collect] 대상 조회 오류:", accError.message);
    return NextResponse.json({ error: "대상을 조회하지 못했습니다." }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  // 일일 캐시(D-023): force 가 아니고 오늘(KST 0시 이후) 이미 수집했으면 Meta 호출 생략.
  if (!force) {
    const { data: snap } = await supabase
      .from(SNAPSHOTS)
      .select("captured_at, followers_count, media_count")
      .eq("tracked_account_id", id)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      snap?.captured_at &&
      Date.parse(snap.captured_at as string) >= startOfTodayKstMs()
    ) {
      return NextResponse.json(
        {
          ok: true,
          cached: true,
          result: {
            username: account.username,
            followersCount: snap.followers_count ?? null,
            mediaCount: snap.media_count ?? null,
            collectedPosts: 0,
            capturedAt: snap.captured_at,
          },
        },
        { status: 200 }
      );
    }
  }

  try {
    // 2) 사용자 토큰 복호화(service-role — api_credentials 는 RLS 정책 없음).
    const admin = createAdminClient();
    const { data: cred, error: credError } = await admin
      .from(CREDENTIALS)
      .select("encrypted_token, ig_user_id")
      .eq("user_id", user.id)
      .eq("channel", CHANNEL)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (credError) throw credError;
    if (!cred?.ig_user_id) {
      return NextResponse.json(
        { error: "먼저 인스타 토큰을 연결하세요." },
        { status: 400 }
      );
    }

    // 사용량 미터(D-024): 캐시 히트(위)는 Meta 를 안 부르므로 카운트 안 함 — 여기 도달한
    // 실제 수집만 게이트·기록. 개인 토큰(본인 cred 있음)이면 collect 무제한이라 통과.
    const meter = await getMeterStatus(admin, user.id, "collect");
    if (!meter.allowed) {
      return NextResponse.json(
        { error: meterBlockedMessage(meter), meter },
        { status: 429 }
      );
    }

    const token = decryptToken(cred.encrypted_token as string);
    const ref = {
      id: account.id as string,
      username: account.username as string,
    };

    // 3) 수집 + 적재. 내 계정(delegated)은 인사이트(노출·도달)까지, 외부는 공개지표만.
    //    내 계정은 반드시 토큰 주인 본인(cred.ig_user_id)을 조회한다(D-023).
    const result =
      account.access_tier === "delegated"
        ? await collectOwnedAccount(admin, ref, token, cred.ig_user_id as string)
        : await collectTrackedAccount(admin, ref, token, cred.ig_user_id as string);

    // 실제 수집 성공 → 미터 1칸 소비(개인=무제한이라 기록만 남고 한도엔 영향 없음).
    await recordUsage(admin, user.id, "collect");

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    if (err instanceof MetaApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "알 수 없는 서버 오류";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "서버 시크릿(SUPABASE_SERVICE_ROLE_KEY)이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    if (message.includes("TOKEN_ENCRYPTION_KEY")) {
      return NextResponse.json(
        { error: "토큰 암호화 키가 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    console.error("[api/accounts/collect] 수집 오류:", message);
    return NextResponse.json({ error: "수집 중 오류가 발생했습니다." }, { status: 500 });
  }
}
