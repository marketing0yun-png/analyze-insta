import { Lightbulb } from "lucide-react";

/**
 * 인스타 용어 쉬운 풀이(접이식) — 오프라인 매장 사장님 대상(D-030).
 * 분석·비교·진단 화면 어디서든 같은 풀이를 보여주려 공용 컴포넌트로 둔다.
 */
const GLOSSARY: { term: string; desc: string }[] = [
  { term: "참여율", desc: "게시물에 반응(좋아요·댓글)한 사람의 비율" },
  { term: "도달", desc: "이 게시물을 본 사람 수 (내 계정만 알 수 있어요)" },
  { term: "노출", desc: "게시물이 화면에 보여진 총 횟수" },
  { term: "릴스", desc: "인스타의 짧은 세로 영상 — 새 고객 유입에 강함" },
  { term: "캐러셀", desc: "여러 장을 넘겨보는 게시물" },
  { term: "건강점수", desc: "참여율·소통·꾸준함·확산을 합친 참고용 0~100점" },
];

export function Glossary({ className = "" }: { className?: string }) {
  return (
    <details className={`bg-muted/30 group rounded-md border text-xs ${className}`}>
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 p-2.5 font-medium select-none">
        <Lightbulb className="size-3.5" /> 인스타 용어가 어렵다면 — 쉬운 풀이
      </summary>
      <ul className="space-y-1.5 border-t p-3">
        {GLOSSARY.map((g) => (
          <li key={g.term} className="text-muted-foreground">
            <strong className="text-foreground">{g.term}</strong> — {g.desc}
          </li>
        ))}
      </ul>
    </details>
  );
}
