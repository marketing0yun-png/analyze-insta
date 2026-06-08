import { AccountDashboard } from "@/components/accounts/account-dashboard";

/**
 * 계정 분석 대시보드 (Phase 1) — 모바일 우선 카드·차트.
 * 데이터는 클라이언트에서 `/api/accounts/metrics`(RLS) 로 조회한다.
 */
export default async function AccountDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <AccountDashboard id={id} />
    </main>
  );
}
