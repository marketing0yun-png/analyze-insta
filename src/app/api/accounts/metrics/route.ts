import "server-only";

import { NextResponse } from "next/server";

import {
  type MediaKind,
  type PostInput,
  computeAccountMetrics,
} from "@/lib/analytics/account-metrics";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ACCOUNTS = "analyze_insta_tracked_accounts";
const SNAPSHOTS = "analyze_insta_account_snapshots";
const MEDIA = "analyze_insta_media_posts";
const METRICS = "analyze_insta_post_metrics";

type MetricRow = {
  captured_at: string;
  like_count: number | null;
  comments_count: number | null;
};

type MediaRow = {
  external_media_id: string;
  permalink: string | null;
  caption: string | null;
  media_type: MediaKind | null;
  posted_at: string | null;
  metrics: MetricRow[] | null;
};

/** 한 게시물의 최신 지표(captured_at 내림차순 첫 행)를 고른다. */
function latestMetric(metrics: MetricRow[] | null): MetricRow | null {
  if (!metrics || metrics.length === 0) return null;
  return [...metrics].sort(
    (a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at)
  )[0];
}

/**
 * GET ?id=... — 분석 대상 1개의 계산된 공개지표 분석.
 * RLS 로 본인 소유만 접근(소유 아니면 빈 결과/404).
 */
export async function GET(req: Request) {
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

  // 대상 + 최신 스냅샷 (RLS)
  const { data: account, error: accError } = await supabase
    .from(ACCOUNTS)
    .select("id, username, account_kind, access_tier, ig_id")
    .eq("id", id)
    .maybeSingle();
  if (accError) {
    console.error("[api/accounts/metrics] 대상 조회 오류:", accError.message);
    return NextResponse.json({ error: "조회 실패." }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: snap } = await supabase
    .from(SNAPSHOTS)
    .select("captured_at, followers_count, media_count, biography")
    .eq("tracked_account_id", id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 게시물 + 지표 (RLS, 임베드)
  const { data: mediaRows, error: mediaError } = await supabase
    .from(MEDIA)
    .select(
      `external_media_id, permalink, caption, media_type, posted_at,
       metrics:${METRICS}(captured_at, like_count, comments_count)`
    )
    .eq("tracked_account_id", id)
    .order("posted_at", { ascending: false });
  if (mediaError) {
    console.error("[api/accounts/metrics] 게시물 조회 오류:", mediaError.message);
    return NextResponse.json({ error: "조회 실패." }, { status: 500 });
  }

  const posts: PostInput[] = ((mediaRows ?? []) as MediaRow[]).map((m) => {
    const latest = latestMetric(m.metrics);
    return {
      externalMediaId: m.external_media_id,
      permalink: m.permalink,
      caption: m.caption,
      mediaType: m.media_type,
      postedAt: m.posted_at,
      likeCount: latest?.like_count ?? null,
      commentsCount: latest?.comments_count ?? null,
    };
  });

  const followers = snap?.followers_count ?? null;
  const metrics = computeAccountMetrics(posts, followers);

  return NextResponse.json(
    {
      account: {
        id: account.id,
        username: account.username,
        account_kind: account.account_kind,
        access_tier: account.access_tier,
        ig_id: account.ig_id,
      },
      snapshot: snap
        ? {
            captured_at: snap.captured_at,
            followers_count: snap.followers_count,
            media_count: snap.media_count,
            biography: snap.biography,
          }
        : null,
      collected_posts: posts.length,
      metrics,
    },
    { status: 200 }
  );
}
