/**
 * 전 화면 공통 배경 메시(D-027) — 인스타 시그니처 컬러의 부드러운 광원.
 * 고정 레이어(-z-10)로 콘텐츠 뒤에 깔린다. 라이트/다크 모두 은은하게 보이도록 조정.
 */
export function Background() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-40 -left-32 size-[36rem] rounded-full bg-[#e1306c]/10 blur-[120px] dark:bg-[#e1306c]/25" />
      <div className="absolute top-1/3 -right-40 size-[34rem] rounded-full bg-[#962fbf]/9 blur-[130px] dark:bg-[#833ab4]/28" />
      <div className="absolute -bottom-52 left-1/4 size-[34rem] rounded-full bg-[#fa7e1e]/8 blur-[130px] dark:bg-[#4f5bd5]/22" />
    </div>
  );
}
