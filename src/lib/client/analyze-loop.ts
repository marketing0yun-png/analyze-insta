/**
 * 클라이언트 분석 반복 호출 헬퍼 (Phase 3, D-023).
 * `/api/accounts/analyze` 는 한 요청에 게시물 10개씩만 처리하고 remaining 을 돌려준다
 * (Vercel 60초/요청 한도 회피). 이 헬퍼가 remaining 이 0 될 때까지 반복 호출하며
 * onProgress 로 진행률을 알린다. 인사이트 탭·일괄 처리 양쪽이 공유한다.
 */

/** 한 요청당 게시물 수(서버 DEFAULT_LIMIT 과 동일). 진행률·ETA 계산에 사용. */
export const ANALYZE_CHUNK = 10;
/** 청크(10개)당 대략 소요 초(비전 포함 경험치). ETA 표시용. */
export const SEC_PER_CHUNK = 35;

export type AnalyzeProgress = {
  /** 이번 실행에서 지금까지 분석한 게시물 수. */
  done: number;
  /** 이번 실행에서 분석해야 할 총 게시물 수(첫 호출 후 확정). */
  total: number;
};

export type AnalyzeLoopResult = {
  analyzed: number;
  alreadyAnalyzed: number;
  /** 비전으로 이미지가 분석된 게시물 누적 수(D-022). */
  imagesAnalyzed: number;
  error?: string;
};

type AnalyzeApiResult = {
  analyzed: number;
  skipped: number;
  remaining: number;
  imagesAnalyzed: number;
};

/**
 * 한 계정을 분석 완료까지 반복 호출.
 * reanalyze=true 면 첫 호출만 reanalyze 로 보내(서버가 1회 리셋) 이후 증분으로 남은 청크를 처리.
 */
export async function analyzeAccountLooped(
  id: string,
  opts: {
    reanalyze?: boolean;
    onProgress?: (p: AnalyzeProgress) => void;
  } = {}
): Promise<AnalyzeLoopResult> {
  let analyzedTotal = 0;
  let imagesTotal = 0;
  let alreadyAnalyzed = 0;
  let total = 0;
  let first = true;

  // MAX_POSTS(30)/CHUNK(10)=3 이므로 넉넉히 상한을 둬 무한루프 방지.
  for (let i = 0; i < 20; i++) {
    let json: { ok?: boolean; error?: string; result?: AnalyzeApiResult };
    try {
      const res = await fetch("/api/accounts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          reanalyze: Boolean(opts.reanalyze) && first,
          limit: ANALYZE_CHUNK,
          // 첫 청크만 LLM 미터 소비(서버). 연속 청크는 같은 분석이라 추가 차감 없음.
          first,
        }),
      });
      json = await res.json();
      if (!res.ok) {
        return {
          analyzed: analyzedTotal,
          alreadyAnalyzed,
          imagesAnalyzed: imagesTotal,
          error: json.error ?? "분석 실패",
        };
      }
    } catch {
      return {
        analyzed: analyzedTotal,
        alreadyAnalyzed,
        imagesAnalyzed: imagesTotal,
        error: "분석 중 네트워크 오류",
      };
    }

    const r = json.result as AnalyzeApiResult;
    if (first) {
      alreadyAnalyzed = r.skipped;
      total = r.analyzed + r.remaining;
      first = false;
      opts.onProgress?.({ done: 0, total });
    }
    analyzedTotal += r.analyzed;
    imagesTotal += r.imagesAnalyzed ?? 0;
    opts.onProgress?.({ done: analyzedTotal, total });

    // 더 남지 않았거나 진전이 없으면(파싱 실패 등) 종료.
    if (r.remaining <= 0 || r.analyzed === 0) break;
  }

  return {
    analyzed: analyzedTotal,
    alreadyAnalyzed,
    imagesAnalyzed: imagesTotal,
  };
}
