/**
 * 콘텐츠 인사이트 집계 (Phase 2) — 순수 함수.
 * 적재된 content_analysis(가공) 행을 대시보드용 집계로 변환한다:
 *   소구점/톤/포맷/키워드 빈도 + 게시물별 분석 카드 데이터.
 * 외부 의존성 없이 서버/클라이언트 양쪽에서 사용 가능(account-metrics 와 동일 사상).
 */

export type ContentAnalysisRow = {
  externalMediaId: string;
  permalink: string | null;
  caption: string | null;
  postedAt: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  model: string | null;
  analyzedAt: string | null;
  topic: string | null;
  appealPoints: string[];
  format: string | null;
  tone: string | null;
  summary: string | null;
  keywords: string[];
};

export type FreqItem = { label: string; count: number };

export type ContentInsights = {
  analyzedPosts: number;
  /** 마지막 분석 시각(ISO). 없으면 null. */
  lastAnalyzedAt: string | null;
  /** 사용 모델(가장 최근). */
  model: string | null;
  /** 소구점 빈도(상위순). */
  appealPoints: FreqItem[];
  /** 카피 톤 분포. */
  tones: FreqItem[];
  /** 콘텐츠 포맷/구성 분포. */
  formats: FreqItem[];
  /** 키워드 빈도(상위순). */
  keywords: FreqItem[];
  /** 게시물별 분석 카드(최신순). */
  posts: ContentAnalysisRow[];
};

/** label→count 누적 후 빈도 내림차순(동률은 라벨 가나다순) 정렬. */
function tally(values: string[], limit?: number): FreqItem[] {
  const map = new Map<string, number>();
  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  const items = [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko"));
  return limit ? items.slice(0, limit) : items;
}

export function computeContentInsights(
  rows: ContentAnalysisRow[]
): ContentInsights {
  const posts = [...rows].sort(
    (a, b) => Date.parse(b.postedAt ?? "") - Date.parse(a.postedAt ?? "")
  );

  const appealPoints = tally(rows.flatMap((r) => r.appealPoints), 12);
  const tones = tally(
    rows.map((r) => r.tone ?? "").filter((s) => s.length > 0)
  );
  const formats = tally(
    rows.map((r) => r.format ?? "").filter((s) => s.length > 0)
  );
  const keywords = tally(rows.flatMap((r) => r.keywords), 20);

  let lastAnalyzedAt: string | null = null;
  let model: string | null = null;
  for (const r of rows) {
    if (r.analyzedAt && (!lastAnalyzedAt || r.analyzedAt > lastAnalyzedAt)) {
      lastAnalyzedAt = r.analyzedAt;
      model = r.model ?? model;
    }
  }

  return {
    analyzedPosts: rows.length,
    lastAnalyzedAt,
    model,
    appealPoints,
    tones,
    formats,
    keywords,
    posts,
  };
}
