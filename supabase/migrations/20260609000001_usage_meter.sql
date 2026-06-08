-- =====================================================================
-- Phase 3.5 — 사용량 미터 (운영 레이어 · D-024)
-- 참조: docs/07_ROADMAP.md "Phase 3.5", docs/09_DECISIONS.md D-024
--
-- "누가 얼마나 쓰나"를 통제하는 가로 레이어. 두 개의 슬라이딩 윈도우 미터:
--   ① collect — 수집·지표 묶음 (Meta·무료/오너 쿼터 보호). 실질 발동은 /collect.
--   ② llm     — 분석·비교 묶음 (LLM·비용). /analyze + /compare 공용 풀.
-- 윈도우 = "최근 2시간 N회"(누적 없음, 쓴 시각 기준 2시간 뒤 재충전).
--
-- ⚠️ 공용 Supabase 프로젝트 → 모든 객체에 접두사 `analyze_insta_` 필수.
-- =====================================================================

-- ---------- ENUM (미터 종류) ----------
create type analyze_insta_usage_action as enum ('collect', 'llm');

-- =====================================================================
-- usage_events — 사용 이력 (user_id·action·시각). 2시간 윈도우 카운트의 원장.
--   쓰기: 서버(service-role)만 — 게이트 통과 후 1행 append.
--   읽기: 본인 것 SELECT (카운트다운 UI 가 잔여/리셋시각 계산).
-- =====================================================================
create table public.analyze_insta_usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.analyze_insta_users (id) on delete cascade,
  action     analyze_insta_usage_action not null,
  created_at timestamptz not null default now()
);

-- (user_id, action, created_at desc) — "최근 2시간 내 action 횟수" 조회 최적화.
create index analyze_insta_usage_events_window_idx
  on public.analyze_insta_usage_events (user_id, action, created_at desc);

alter table public.analyze_insta_usage_events enable row level security;

-- 본인 사용 이력만 SELECT (잔여 횟수·리셋 시각 계산용). 쓰기 정책 없음 → service-role 만.
create policy usage_events_select_own on public.analyze_insta_usage_events
  for select using (user_id = auth.uid());
