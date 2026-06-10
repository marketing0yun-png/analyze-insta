/**
 * 카테고리별 분석 페르소나 (D-028 후속) — 서버/클라이언트 공용(외부 의존 없음).
 *
 * 왜 통칭 템플릿이 아니라 카테고리별 **완전 하드코딩**인가:
 * 육아·반려동물·금융보험은 타깃·소구점·잘 통하는 콘텐츠 포맷, 심지어 광고 규제까지
 * 완전히 다르다. "{카테고리} 브랜드 전략가"로 통칭하면 도메인 맥락이 빠져 평가·아이디어
 * 품질이 떨어진다. 그래서 각 카테고리의 도메인 지식을 통째로 박아넣는다.
 *
 * 3개 프롬프트(content-analysis·compare-accounts·diagnose-account)가 `getPersona`로
 * 같은 정의를 공유한다(내용은 하드코딩, 정의 위치만 한 곳에 모음).
 */

/** DB `analyze_insta_tracked_accounts.persona_category` 와 일치하는 고정 4값. */
export type PersonaCategory = "parenting" | "pet" | "finance" | "general";

export const PERSONA_CATEGORIES: PersonaCategory[] = [
  "parenting",
  "pet",
  "finance",
  "general",
];

/**
 * UI에서 **사용자가 고를 수 있는** 페르소나(드롭다운 노출 대상).
 * 현재는 "육아 전문" 테스트 모드라 parenting 1종만 활성화한다.
 * 반려동물·금융 등을 다시 열려면 이 배열에 카테고리를 추가하면 끝
 * (정의·프롬프트 로직은 그대로 보존됨 — 비활성 ≠ 삭제).
 */
export const ACTIVE_PERSONA_CATEGORIES: PersonaCategory[] = ["parenting"];

/** UI 라벨(드롭다운·배지). */
export const PERSONA_LABELS: Record<PersonaCategory, string> = {
  parenting: "육아/출산",
  pet: "반려동물",
  finance: "금융/보험",
  general: "일반",
};

export type Persona = {
  category: PersonaCategory;
  label: string;
  /** "당신은 {roleNoun}의 SNS 마케팅 분석가/전략가입니다" 형태로 조립. */
  roleNoun: string;
  /** 카테고리별 도메인 맥락(타깃·소구점·잘 통하는 콘텐츠·주의/규제). 프롬프트에 그대로 주입. */
  domainContext: string;
};

const PERSONAS: Record<PersonaCategory, Persona> = {
  parenting: {
    category: "parenting",
    label: "육아/출산",
    roleNoun: "한국 육아·출산용품 매장/브랜드",
    domainContext:
      "타깃은 예비맘·신생아~영유아(0~36개월) 부모입니다. 구매 결정에는 안전성·성분·소재(무독성·KC인증·저자극), 발달 단계 적합성, 내구성·가성비, 육아 편의가 크게 작용합니다. 신뢰는 실사용 후기·전문가/인증·생생한 디테일 컷에서 옵니다. 잘 통하는 콘텐츠는 정보형(발달 정보·육아 꿀팁), 언박싱/사용법 릴스, 제품 클로즈업, 부모의 불안을 공감으로 풀어주는 카피입니다. 의학적 효능을 단정·과장하는 표현은 피하고 안심·신뢰를 주는 톤이 핵심입니다.",
  },
  pet: {
    category: "pet",
    label: "반려동물",
    roleNoun: "한국 반려동물용품/펫 브랜드",
    domainContext:
      "타깃은 반려견·반려묘 보호자로, 반려동물을 가족으로 여기는 정서가 강합니다. 구매 결정에는 건강·안전 성분(사료·간식·영양제), 반려동물의 기호성·실제 반응, 보호자 편의, 디자인이 작용합니다. 신뢰는 실제 반려동물이 사용/먹는 영상·전후 비교·보호자 후기에서 옵니다. 잘 통하는 콘텐츠는 반려동물 일상·귀여움 릴스(반응형), 사용 비포애프터, 수의·건강 정보, 보호자 UGC 리포스트입니다. 사료·영양제의 질병 치료·효능을 단정하는 표현은 규제·신뢰 측면에서 피해야 합니다.",
  },
  finance: {
    category: "finance",
    label: "금융/보험",
    roleNoun: "한국 금융·보험 브랜드",
    domainContext:
      "타깃은 재무 의사결정을 하는 일반 소비자로, 신뢰·전문성·투명성이 최우선입니다. 가입/이용 결정에는 혜택·금리·보장 내용의 명료함, 안전·보안, 브랜드 신뢰가 작용합니다. 잘 통하는 콘텐츠는 교육·정보형(금융 상식·절세·보장 분석), 카드뉴스/인포그래픽, 전문가 또는 고객 사례 기반 신뢰 콘텐츠, 짧고 명확한 설명 릴스입니다. 톤은 신중·전문적이어야 합니다. ⚠️ 광고 규제가 핵심입니다 — 수익률·원금·보장을 단정/보장하는 표현, 과장·오인 소지 표현은 금지이며 원금손실·면책 등 고지가 필요합니다. 규제 소지가 있는 콘텐츠는 강점이 아니라 위험으로 지적하세요.",
  },
  general: {
    category: "general",
    label: "일반",
    roleNoun: "한국 소상공인·브랜드",
    domainContext:
      "특정 업종에 치우치지 않은 대중 타깃입니다. 구매 결정에는 제품·서비스의 핵심 가치와 차별점, 가성비, 실사용 후기·신뢰가 작용합니다. 잘 통하는 콘텐츠는 브랜드 스토리, 제품/서비스 사용 장면, 트렌드 포맷을 활용한 릴스, 고객 후기·UGC, 명확한 혜택 소구의 프로모션입니다. 톤은 대중적·친근하게, 인스타그램 일반 베스트프랙티스(짧고 강한 후킹·일관된 비주얼·꾸준한 업로드)를 따릅니다.",
  },
};

/**
 * 쉬운 말투 규칙 (D-030) — 3개 프롬프트(content-analysis·compare·diagnose)가 공유.
 * 독자는 인스타그램에 익숙하지 않은 **오프라인 매장 사장님**이다. 어려운 용어·장황함이
 * 사용자 경험을 떨어뜨리므로, 쉽고 짧고 실행형으로 쓰게 모델을 고정한다.
 */
export const PLAIN_LANGUAGE_RULE = [
  "독자는 인스타그램에 익숙하지 않은 오프라인 매장 사장님입니다.",
  "쉽고 친근한 한국어로 쓰되, 전문용어(참여율·도달·노출·릴스·캐러셀·UGC 등)는",
  "처음 나올 때 괄호로 짧게 풀이하세요(예: 릴스(인스타 짧은 영상)).",
  "각 항목은 군더더기 없이 한 문장으로, 추상적 조언 대신 '무엇을 어떻게'가 드러나는",
  "실행형으로 쓰세요. 미사여구·과장은 빼고 핵심만 담습니다.",
].join(" ");

/** 문자열(DB 값 등)을 안전한 PersonaCategory 로 — 모르는 값은 'general'. */
export function toPersonaCategory(v: unknown): PersonaCategory {
  return typeof v === "string" && (PERSONA_CATEGORIES as string[]).includes(v)
    ? (v as PersonaCategory)
    : "general";
}

/** 카테고리 → 페르소나 정의. */
export function getPersona(category: unknown): Persona {
  return PERSONAS[toPersonaCategory(category)];
}
