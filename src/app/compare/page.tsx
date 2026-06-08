import { CompareView } from "@/components/accounts/compare-view";

/**
 * 매장 비교 분석 (Phase 2.5) — 참여율 리더보드 + 선택 + LLM 냉정 평가.
 * 데이터는 클라이언트에서 `/api/accounts/ranking`·`/api/accounts/compare`(RLS) 로.
 */
export default function ComparePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <CompareView />
    </main>
  );
}
