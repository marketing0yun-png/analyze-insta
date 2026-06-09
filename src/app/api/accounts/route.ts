import "server-only";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_LIMITS, getExternalAccountUsage } from "@/lib/server/usage-meter";

/** RLS(사용자 컨텍스트) 사용 — 본인 소유 행만 접근. Node 런타임 필요 없음이나 통일. */
export const runtime = "nodejs";

const ACCOUNTS = "analyze_insta_tracked_accounts";
const SNAPSHOTS = "analyze_insta_account_snapshots";
const CATEGORIES = "analyze_insta_categories";

const ACCOUNT_KINDS = new Set(["competitor", "influencer", "owned"]);

/** username 정규화: @ 제거, 공백 제거, 소문자. */
function normalizeUsername(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Instagram username 허용 문자(영숫자·점·밑줄, 1~30). */
function isValidUsername(u: string): boolean {
  return /^[a-z0-9._]{1,30}$/.test(u);
}

/**
 * GET — 본인 분석 대상 목록 + 각 계정의 최신 스냅샷(팔로워/미디어수).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ accounts: [] }, { status: 200 });
  }

  const { data, error } = await supabase
    .from(ACCOUNTS)
    .select(
      `id, username, account_kind, access_tier, category_id, ig_id, created_at,
       snapshots:${SNAPSHOTS}(captured_at, followers_count, media_count)`
    )
    .order("created_at", { ascending: false })
    .order("captured_at", {
      referencedTable: SNAPSHOTS,
      ascending: false,
    })
    .limit(1, { referencedTable: SNAPSHOTS });

  if (error) {
    console.error("[api/accounts] GET 오류:", error.message);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }

  const accounts = (data ?? []).map((row) => {
    const snaps = (row.snapshots ?? []) as Array<{
      captured_at: string;
      followers_count: number | null;
      media_count: number | null;
    }>;
    const latest = snaps[0] ?? null;
    return {
      id: row.id,
      username: row.username,
      account_kind: row.account_kind,
      access_tier: row.access_tier,
      category_id: row.category_id,
      ig_id: row.ig_id,
      created_at: row.created_at,
      latest_snapshot: latest,
    };
  });

  return NextResponse.json({ accounts }, { status: 200 });
}

/**
 * POST { username, account_kind?, category_name? } — 분석 대상 등록.
 * category_name 이 있으면 동명 카테고리를 찾거나 새로 만든다.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. 구글로 로그인한 뒤 다시 시도하세요." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    username?: unknown;
    account_kind?: unknown;
    category_name?: unknown;
  } | null;

  const username = normalizeUsername(body?.username);
  if (!username) {
    return NextResponse.json({ error: "username 을 입력하세요." }, { status: 400 });
  }
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "유효한 인스타 username 형식이 아닙니다(영문·숫자·. _ 만)." },
      { status: 400 }
    );
  }

  const accountKind =
    typeof body?.account_kind === "string" && ACCOUNT_KINDS.has(body.account_kind)
      ? body.account_kind
      : "competitor";

  // 외부 계정 개수 한도(D-024): 체험 3 / 개인 10. 내 계정(owned)은 self 라우트 전용이라 제외.
  // 티어·카운트는 service-role 로 확인(api_credentials 는 RLS 정책 없음).
  if (accountKind !== "owned") {
    try {
      const admin = createAdminClient();
      const usage = await getExternalAccountUsage(admin, user.id);
      if (!usage.allowed) {
        const tierLabel = usage.tier === "trial" ? "체험" : "개인 토큰";
        const hint =
          usage.tier === "trial"
            ? " 개인 토큰을 연결하면 최대 10개까지 등록할 수 있어요."
            : "";
        return NextResponse.json(
          {
            error:
              `외부 계정은 ${tierLabel} 기준 ${ACCOUNT_LIMITS[usage.tier]}개까지 등록할 수 있어요 ` +
              `(현재 ${usage.count}개).${hint} 불필요한 계정을 지우고 다시 시도하세요.`,
          },
          { status: 409 }
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      // service-role 미설정 등은 등록 자체를 막지 않도록 경고만 남기고 통과(개발 편의).
      console.warn("[api/accounts] 개수 한도 확인 건너뜀:", message);
    }
  }

  // 카테고리 find-or-create (선택).
  let categoryId: string | null = null;
  const categoryName =
    typeof body?.category_name === "string" ? body.category_name.trim() : "";
  if (categoryName) {
    const { data: existing } = await supabase
      .from(CATEGORIES)
      .select("id")
      .eq("name", categoryName)
      .limit(1)
      .maybeSingle();
    if (existing) {
      categoryId = existing.id as string;
    } else {
      const { data: created, error: catError } = await supabase
        .from(CATEGORIES)
        .insert({ name: categoryName })
        .select("id")
        .single();
      if (catError) {
        console.error("[api/accounts] 카테고리 생성 오류:", catError.message);
        return NextResponse.json(
          { error: "카테고리 생성에 실패했습니다." },
          { status: 500 }
        );
      }
      categoryId = created.id as string;
    }
  }

  const { data: inserted, error } = await supabase
    .from(ACCOUNTS)
    .insert({
      username,
      account_kind: accountKind,
      category_id: categoryId,
      // access_tier 는 기본 'public'(외부 공개지표). 위임은 별도 흐름에서 승격.
    })
    .select("id, username, account_kind, access_tier, category_id, ig_id, created_at")
    .single();

  if (error) {
    // unique(user_id, channel, username) 위반 → 이미 등록됨.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `@${username} 은(는) 이미 등록되어 있습니다.` },
        { status: 409 }
      );
    }
    console.error("[api/accounts] POST 오류:", error.message);
    return NextResponse.json({ error: "등록에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(
    { account: { ...inserted, latest_snapshot: null } },
    { status: 201 }
  );
}

/**
 * DELETE ?id=... — 본인 분석 대상 삭제(연관 스냅샷/게시물/지표는 cascade).
 */
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "세션이 없습니다." }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id 가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase.from(ACCOUNTS).delete().eq("id", id);
  if (error) {
    console.error("[api/accounts] DELETE 오류:", error.message);
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
