/**
 * 계정 지표 계산 (Phase 1) — 순수 함수.
 * 수집된 raw(media_posts + 최신 post_metrics)로 공개지표 분석값을 만든다:
 *   참여율, 업로드 빈도/시간대/요일, 포맷 비중, 상위 게시물.
 * 시간대/요일은 한국 기준(KST, UTC+9)으로 환산한다(타깃 광고주가 국내).
 *
 * 서버/클라이언트 양쪽에서 쓸 수 있도록 외부 의존성 없이 구현.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type MediaKind = "image" | "video" | "carousel" | "reel";

const FORMAT_LABELS: Record<MediaKind | "unknown", string> = {
  image: "이미지",
  video: "동영상",
  carousel: "캐러셀",
  reel: "릴스",
  unknown: "기타",
};

/** 한 게시물 + 최신 지표(좋아요/댓글). like/comments 가 모두 null 이면 미수집으로 간주. */
export type PostInput = {
  externalMediaId: string;
  permalink: string | null;
  caption: string | null;
  mediaType: MediaKind | null;
  postedAt: string | null; // ISO
  likeCount: number | null;
  commentsCount: number | null;
};

export type FormatShare = {
  kind: MediaKind | "unknown";
  label: string;
  count: number;
  pct: number; // 0~100
};

export type HourBucket = { hour: number; count: number }; // 0~23 (KST)
export type WeekdayBucket = { weekday: number; label: string; count: number }; // 0=일

export type TopPost = {
  externalMediaId: string;
  permalink: string | null;
  caption: string | null;
  mediaType: MediaKind | null;
  postedAt: string | null;
  likeCount: number;
  commentsCount: number;
  engagement: number; // like + comments
};

export type AccountMetrics = {
  analyzedPosts: number;
  avgLikes: number | null;
  avgComments: number | null;
  /** 참여율(%) = (평균 좋아요+댓글) / 팔로워 × 100. 팔로워 미상이면 null. */
  engagementRate: number | null;
  /** 주당 업로드 수(분석 게시물 기간 기준). 게시물 2개 미만이면 null. */
  postsPerWeek: number | null;
  /** 평균 업로드 간격(시간). 게시물 2개 미만이면 null. */
  avgIntervalHours: number | null;
  formats: FormatShare[];
  byHour: HourBucket[];
  byWeekday: WeekdayBucket[];
  topPosts: TopPost[];
};

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function computeAccountMetrics(
  posts: PostInput[],
  followersCount: number | null
): AccountMetrics {
  // 지표(좋아요/댓글)가 하나라도 있는 게시물만 분석 대상으로.
  const measured = posts.filter(
    (p) => p.likeCount != null || p.commentsCount != null
  );
  const analyzedPosts = measured.length;

  // 평균 참여
  let avgLikes: number | null = null;
  let avgComments: number | null = null;
  let engagementRate: number | null = null;
  if (analyzedPosts > 0) {
    const sumLikes = measured.reduce((s, p) => s + (p.likeCount ?? 0), 0);
    const sumComments = measured.reduce((s, p) => s + (p.commentsCount ?? 0), 0);
    avgLikes = round(sumLikes / analyzedPosts);
    avgComments = round(sumComments / analyzedPosts);
    if (followersCount && followersCount > 0) {
      engagementRate = round(
        ((avgLikes + avgComments) / followersCount) * 100,
        2
      );
    }
  }

  // 포맷 비중
  const formatCounts = new Map<MediaKind | "unknown", number>();
  for (const p of posts) {
    const kind = (p.mediaType ?? "unknown") as MediaKind | "unknown";
    formatCounts.set(kind, (formatCounts.get(kind) ?? 0) + 1);
  }
  const totalForFormat = posts.length || 1;
  const formats: FormatShare[] = [...formatCounts.entries()]
    .map(([kind, count]) => ({
      kind,
      label: FORMAT_LABELS[kind],
      count,
      pct: round((count / totalForFormat) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // 시간대/요일 (KST)
  const byHour: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: 0,
  }));
  const byWeekday: WeekdayBucket[] = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    count: 0,
  }));
  const postedTimes: number[] = [];
  for (const p of posts) {
    if (!p.postedAt) continue;
    const t = Date.parse(p.postedAt);
    if (Number.isNaN(t)) continue;
    postedTimes.push(t);
    const kst = new Date(t + KST_OFFSET_MS);
    byHour[kst.getUTCHours()].count += 1;
    byWeekday[kst.getUTCDay()].count += 1;
  }

  // 업로드 빈도
  let postsPerWeek: number | null = null;
  let avgIntervalHours: number | null = null;
  if (postedTimes.length >= 2) {
    postedTimes.sort((a, b) => a - b);
    const spanMs = postedTimes[postedTimes.length - 1] - postedTimes[0];
    if (spanMs > 0) {
      const spanDays = spanMs / (24 * 60 * 60 * 1000);
      postsPerWeek = round(((postedTimes.length - 1) / spanDays) * 7);
      avgIntervalHours = round(
        spanMs / (postedTimes.length - 1) / (60 * 60 * 1000)
      );
    }
  }

  // 상위 게시물(참여 기준 5개)
  const topPosts: TopPost[] = measured
    .map((p) => {
      const likeCount = p.likeCount ?? 0;
      const commentsCount = p.commentsCount ?? 0;
      return {
        externalMediaId: p.externalMediaId,
        permalink: p.permalink,
        caption: p.caption,
        mediaType: p.mediaType,
        postedAt: p.postedAt,
        likeCount,
        commentsCount,
        engagement: likeCount + commentsCount,
      };
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5);

  return {
    analyzedPosts,
    avgLikes,
    avgComments,
    engagementRate,
    postsPerWeek,
    avgIntervalHours,
    formats,
    byHour,
    byWeekday,
    topPosts,
  };
}
