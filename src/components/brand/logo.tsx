/**
 * 브랜드 로고 마크(D-026) — "분석 도구" 메타포: 돋보기 + 상승 추세선.
 * stroke=currentColor 라 색 상자 안에 넣어 색을 상속받는다.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="트렌드 분석기 로고"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 돋보기 렌즈 */}
      <circle cx="216" cy="216" r="140" strokeWidth="34" />
      {/* 손잡이 */}
      <line x1="315" y1="315" x2="430" y2="430" strokeWidth="48" />
      {/* 렌즈 안 상승 추세선 */}
      <polyline points="150,252 198,198 250,232 304,150" strokeWidth="26" />
    </svg>
  );
}
