-- =====================================================================
-- Phase 3.5 — 해시태그 신청 + 큐레이션 (운영 레이어 · D-024/D-025)
-- 참조: docs/07_ROADMAP.md "Phase 3.5", docs/09_DECISIONS.md D-025
--
-- 해시태그 검색은 토큰당 7일 30개 하드 쿼터(개인 토큰 전용 직접 검색).
-- 체험 유저는 직접 검색 대신 **신청**만 한다 → 마스터가 주 30개 쿼터 내에서
-- 모아 검색하고, 결과를 **큐레이션**으로 모두에게 공통 노출한다.
--
-- ⚠️ 공용 Supabase 프로젝트 → 모든 객체에 접두사 `analyze_insta_` 필수.
-- =====================================================================

-- ---------- 신청 상태 ENUM ----------
create type analyze_insta_hashtag_request_status as enum
  ('requested', 'fulfilled', 'rejected');

-- =====================================================================
-- hashtag_requests — 체험 유저의 해시태그 신청(날짜·키워드·user_id).
--   쓰기: 본인 INSERT (신청). 상태 변경(fulfilled/rejected)은 마스터(service-role).
--   읽기: 본인 신청 SELECT.
-- =====================================================================
create table public.analyze_insta_hashtag_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.analyze_insta_users (id) on delete cascade,
  keyword      text not null,
  status       analyze_insta_hashtag_request_status not null default 'requested',
  note         text,
  requested_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index analyze_insta_hashtag_requests_status_idx
  on public.analyze_insta_hashtag_requests (status, requested_at desc);
create index analyze_insta_hashtag_requests_user_idx
  on public.analyze_insta_hashtag_requests (user_id, requested_at desc);

alter table public.analyze_insta_hashtag_requests enable row level security;

create policy hashtag_requests_select_own on public.analyze_insta_hashtag_requests
  for select using (user_id = auth.uid());

create policy hashtag_requests_insert_own on public.analyze_insta_hashtag_requests
  for insert with check (user_id = auth.uid());

-- =====================================================================
-- curated_hashtags — 마스터가 큐레이션한 공통 해시태그(모두에게 노출).
--   쓰기: 마스터(service-role)만. 읽기: 인증 사용자 전체(공통 노출).
-- =====================================================================
create table public.analyze_insta_curated_hashtags (
  id         uuid primary key default gen_random_uuid(),
  hashtag    text not null,
  note       text,
  created_at timestamptz not null default now()
);

create index analyze_insta_curated_hashtags_created_idx
  on public.analyze_insta_curated_hashtags (created_at desc);

alter table public.analyze_insta_curated_hashtags enable row level security;

-- 공통 노출 — 인증된 사용자는 모두 읽기. 쓰기 정책 없음 → service-role(마스터)만.
create policy curated_hashtags_select_all on public.analyze_insta_curated_hashtags
  for select using (auth.role() = 'authenticated');
