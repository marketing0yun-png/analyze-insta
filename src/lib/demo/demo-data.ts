/**
 * 데모(목업) 데이터 — 로그아웃(비로그인) 방문자에게 제품을 보여주기 위한 고정 예시값(D-026).
 * 실제 API 를 호출하지 않으며, 어떤 사용자 데이터도 아니다(전부 가공된 샘플).
 * 시나리오: 육아용품 매장 "@demo_baby_store" + 경쟁사 2곳.
 */

import type { AccountMetrics } from "@/lib/analytics/account-metrics";

export const DEMO_ACCOUNT_ID = "demo";

/** 홈 "분석 대상 계정" 미리보기용 목업 목록. */
export type DemoAccount = {
  id: string;
  username: string;
  account_kind: "owned" | "competitor" | "influencer";
  followers: number;
  media: number;
  /** 상세 대시보드로 진입 가능한 계정인지(현재는 내 계정 데모만). */
  hasDashboard: boolean;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: DEMO_ACCOUNT_ID,
    username: "demo_baby_store",
    account_kind: "owned",
    followers: 12840,
    media: 318,
    hasDashboard: true,
  },
  {
    id: "demo-rival-1",
    username: "happy_kids_mall",
    account_kind: "competitor",
    followers: 28510,
    media: 642,
    hasDashboard: false,
  },
  {
    id: "demo-rival-2",
    username: "mom_picks_official",
    account_kind: "competitor",
    followers: 9320,
    media: 205,
    hasDashboard: false,
  },
];

/** 홈 사용량 미터 미리보기용 목업(체험 티어 예시). */
export const DEMO_USAGE = {
  tier: "trial" as const,
  collect: { remaining: 3, limit: 5 },
  llm: { remaining: 4, limit: 5 },
};

/** 시간대(0~23) 게시 빈도 — 저녁 시간대(20~22시)에 몰린 패턴. */
const DEMO_BY_HOUR = Array.from({ length: 24 }, (_, hour) => {
  const peak = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 1, 2, 3, 2, 1, 1, 2, 3, 4, 5, 6, 5, 3, 1];
  return { hour, count: peak[hour] };
});

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const DEMO_BY_WEEKDAY = [3, 8, 6, 7, 9, 11, 5].map((count, weekday) => ({
  weekday,
  label: WEEKDAY_LABELS[weekday],
  count,
}));

export const DEMO_METRICS: AccountMetrics = {
  analyzedPosts: 24,
  avgLikes: 412,
  avgComments: 37,
  engagementRate: 3.5,
  postsPerWeek: 4.2,
  avgIntervalHours: 40,
  // 내 계정(delegated) 전용 — 노출·도달·저장·조회.
  avgReach: 8430,
  avgImpressions: 11200,
  avgSaved: 96,
  avgVideoViews: 5210,
  formats: [
    { kind: "reel", label: "릴스", count: 11, pct: 46 },
    { kind: "carousel", label: "캐러셀", count: 8, pct: 33 },
    { kind: "image", label: "이미지", count: 5, pct: 21 },
  ],
  byHour: DEMO_BY_HOUR,
  byWeekday: DEMO_BY_WEEKDAY,
  topPosts: [
    {
      externalMediaId: "demo-1",
      permalink: null,
      caption: "🍼 신생아 필수템 5가지 — 첫 출산 준비 체크리스트 (저장 필수!)",
      mediaType: "carousel",
      postedAt: "2026-05-28T11:00:00.000Z",
      likeCount: 1284,
      commentsCount: 142,
      engagement: 1426,
      reach: 18600,
      impressions: 24300,
    },
    {
      externalMediaId: "demo-2",
      permalink: null,
      caption: "이유식 거부하는 아기, 이렇게 해보세요 👶 (릴스)",
      mediaType: "reel",
      postedAt: "2026-05-24T12:30:00.000Z",
      likeCount: 968,
      commentsCount: 88,
      engagement: 1056,
      reach: 15200,
      impressions: 19800,
    },
    {
      externalMediaId: "demo-3",
      permalink: null,
      caption: "우리 매장 베스트 유모차 비교 ⭐ 가벼움 vs 승차감",
      mediaType: "carousel",
      postedAt: "2026-05-20T10:15:00.000Z",
      likeCount: 742,
      commentsCount: 61,
      engagement: 803,
      reach: 11400,
      impressions: 14100,
    },
    {
      externalMediaId: "demo-4",
      permalink: null,
      caption: "주말 한정 기저귀 묶음 특가 🎁 (이번 주만!)",
      mediaType: "image",
      postedAt: "2026-05-17T09:00:00.000Z",
      likeCount: 531,
      commentsCount: 44,
      engagement: 575,
      reach: 8900,
      impressions: 10600,
    },
    {
      externalMediaId: "demo-5",
      permalink: null,
      caption: "아기 수면교육 후기 모음 💤 실제 고객님 사연",
      mediaType: "reel",
      postedAt: "2026-05-13T13:45:00.000Z",
      likeCount: 489,
      commentsCount: 53,
      engagement: 542,
      reach: 8100,
      impressions: 9800,
    },
  ],
};

/** 대시보드(account-dashboard) 가 기대하는 MetricsResponse 형태의 데모 응답. */
export const DEMO_DASHBOARD = {
  account: {
    id: DEMO_ACCOUNT_ID,
    username: "demo_baby_store",
    account_kind: "owned" as const,
    access_tier: "delegated" as const,
  },
  snapshot: {
    captured_at: "2026-06-08T15:00:00.000Z",
    followers_count: 12840,
    media_count: 318,
    biography: "👶 육아용품 셀렉트샵 · 신생아~36개월 · 당일배송 (※ 데모 예시 계정)",
  },
  collected_posts: 24,
  metrics: DEMO_METRICS,
};
