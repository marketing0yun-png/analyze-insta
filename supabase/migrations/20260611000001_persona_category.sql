-- =====================================================================
-- persona_category — 계정별 분석 페르소나 카테고리 (고정 4값). D-028 후속.
-- 프롬프트(콘텐츠 분석·비교·전략 진단)가 이 값으로 카테고리별 **하드코딩 페르소나**를
-- 선택한다. 통칭 템플릿 대신 카테고리마다 도메인 지식을 통째로 박아넣기 위함.
--   parenting=육아/출산 · pet=반려동물 · finance=금융/보험 · general=일반
-- =====================================================================
alter table public.analyze_insta_tracked_accounts
  add column if not exists persona_category text not null default 'general'
    check (persona_category in ('parenting', 'pet', 'finance', 'general'));

-- 기존 계정(마이그레이션 시점에 이미 존재)은 육아/출산으로 초기화 — 현 광고주 도메인.
update public.analyze_insta_tracked_accounts set persona_category = 'parenting';
