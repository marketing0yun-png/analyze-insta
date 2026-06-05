-- =====================================================================
-- Meta SNS 트렌드 분석기 — 초기 스키마 (Phase 0)
-- 참조: docs/04_DATA_MODEL.md, docs/06_AUTH_SECURITY.md
-- 원칙: raw(원본 수집) / 가공(분석·리포트) 분리, 모든 사용자 데이터 RLS.
--   - 사용자(anon/구글): 자기 user_id 행만 (RLS).
--   - 수집 잡/마스터: service-role 로 RLS 우회 (서버사이드 전용).
--   - api_credentials: 클라이언트 직접 접근 전면 차단 (정책 없음 = 거부).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- ENUM 타입 ----------
create type user_role     as enum ('master', 'user');
create type channel_kind  as enum ('instagram', 'threads', 'facebook');
create type account_kind  as enum ('competitor', 'influencer', 'owned');
create type access_tier   as enum ('public', 'delegated'); -- 공개지표 vs 완전분석
create type media_kind    as enum ('image', 'video', 'carousel', 'reel');
create type hashtag_status as enum ('pending', 'done', 'quota_blocked');
create type metric_source as enum ('official', 'thirdparty');

-- =====================================================================
-- users — auth.users 1:1 매핑. 익명/구글 공통. 구글 link 시 id 유지.
-- =====================================================================
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       user_role not null default 'user',
  created_at timestamptz not null default now()
);

-- auth.users 생성 시 public.users 자동 매핑 (익명 로그인 포함)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- api_credentials — 사용자별 Meta 토큰(암호화). ⚠️ 클라이언트 접근 금지.
-- =====================================================================
create table public.api_credentials (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  channel          channel_kind not null default 'instagram',
  ig_user_id       text,
  encrypted_token  text not null,          -- 암호화된 토큰 (평문 금지)
  token_expires_at timestamptz,
  created_at       timestamptz not null default now()
);
create index api_credentials_user_id_idx on public.api_credentials (user_id);

-- =====================================================================
-- categories — 사용자 정의 분석 카테고리 (예: 육아용품)
-- =====================================================================
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.users (id) on delete cascade,
  name       text not null,
  channel    channel_kind not null default 'instagram',
  created_at timestamptz not null default now()
);
create index categories_user_id_idx on public.categories (user_id);

-- =====================================================================
-- tracked_accounts — 분석 대상 계정 (외부/위임). access_tier 가 분기 핵심.
-- =====================================================================
create table public.tracked_accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.users (id) on delete cascade,
  category_id  uuid references public.categories (id) on delete set null,
  channel      channel_kind not null default 'instagram',
  username     text not null,
  ig_id        text,
  account_kind account_kind not null default 'competitor',
  access_tier  access_tier  not null default 'public',
  created_at   timestamptz not null default now(),
  unique (user_id, channel, username)
);
create index tracked_accounts_user_id_idx  on public.tracked_accounts (user_id);
create index tracked_accounts_category_idx on public.tracked_accounts (category_id);

-- =====================================================================
-- account_snapshots (raw) — 계정 시계열
-- =====================================================================
create table public.account_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  tracked_account_id uuid not null references public.tracked_accounts (id) on delete cascade,
  captured_at        timestamptz not null default now(),
  followers_count    integer,
  follows_count      integer,
  media_count        integer,
  biography          text
);
create index account_snapshots_account_idx on public.account_snapshots (tracked_account_id, captured_at desc);

-- =====================================================================
-- media_posts (raw) — 게시물 원본
-- =====================================================================
create table public.media_posts (
  id                 uuid primary key default gen_random_uuid(),
  tracked_account_id uuid not null references public.tracked_accounts (id) on delete cascade,
  external_media_id  text not null,
  permalink          text,
  caption            text,
  media_type         media_kind,
  posted_at          timestamptz,
  media_url          text,
  raw                jsonb,
  created_at         timestamptz not null default now(),
  unique (tracked_account_id, external_media_id)
);
create index media_posts_account_idx   on public.media_posts (tracked_account_id, posted_at desc);

-- =====================================================================
-- post_metrics (raw) — 게시물 지표. 공개 / 위임전용(nullable) / 서드파티 구분.
-- =====================================================================
create table public.post_metrics (
  id             uuid primary key default gen_random_uuid(),
  media_post_id  uuid not null references public.media_posts (id) on delete cascade,
  captured_at    timestamptz not null default now(),
  source         metric_source not null default 'official',
  -- 공개지표 (외부계정 가능)
  like_count     integer,
  comments_count integer,
  -- 위임(owned) 계정 전용 — 외부계정은 항상 null (노출·도달 확보 불가)
  reach          integer,
  impressions    integer,
  saved          integer,
  video_views    integer,
  plays          integer,
  profile_visits integer,
  -- Phase 4 서드파티 보강
  play_count_3p  integer,
  comment_texts  jsonb
);
create index post_metrics_post_idx on public.post_metrics (media_post_id, captured_at desc);

-- =====================================================================
-- hashtag_jobs (raw) — 해시태그 조회 이력 + 쿼터(7일/30개) 추적
-- =====================================================================
create table public.hashtag_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  credential_id    uuid references public.api_credentials (id) on delete set null,
  hashtag          text not null,
  hashtag_id       text,
  requested_at     timestamptz not null default now(),
  quota_week_start date not null,           -- 7일 쿼터 창 시작
  status           hashtag_status not null default 'pending'
);
create index hashtag_jobs_user_quota_idx on public.hashtag_jobs (user_id, quota_week_start);

-- =====================================================================
-- hashtag_results (raw) — 해시태그 수집 게시물. ⚠️ 작성자 정보 없음(Meta 미제공).
-- =====================================================================
create table public.hashtag_results (
  id                uuid primary key default gen_random_uuid(),
  hashtag_job_id    uuid not null references public.hashtag_jobs (id) on delete cascade,
  external_media_id text,
  caption           text,
  like_count        integer,
  comments_count    integer,
  media_type        media_kind,
  permalink         text,
  raw               jsonb
);
create index hashtag_results_job_idx on public.hashtag_results (hashtag_job_id);

-- =====================================================================
-- content_analysis (가공) — AI 콘텐츠 분석 (Phase 2)
-- =====================================================================
create table public.content_analysis (
  id            uuid primary key default gen_random_uuid(),
  media_post_id uuid not null references public.media_posts (id) on delete cascade,
  model         text,
  analyzed_at   timestamptz not null default now(),
  topic         text,
  appeal_points jsonb,
  format        text,
  tone          text,
  summary       text,
  keywords      jsonb
);
create index content_analysis_post_idx on public.content_analysis (media_post_id);

-- =====================================================================
-- reports (가공) — 리포트 캐시
-- =====================================================================
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.users (id) on delete cascade,
  category_id  uuid references public.categories (id) on delete set null,
  kind         text not null,               -- account | hashtag | comparison
  payload      jsonb,
  generated_at timestamptz not null default now()
);
create index reports_user_idx on public.reports (user_id);

-- =====================================================================
-- RLS — 전 테이블 활성화
-- =====================================================================
alter table public.users            enable row level security;
alter table public.api_credentials  enable row level security;
alter table public.categories       enable row level security;
alter table public.tracked_accounts enable row level security;
alter table public.account_snapshots enable row level security;
alter table public.media_posts      enable row level security;
alter table public.post_metrics     enable row level security;
alter table public.hashtag_jobs     enable row level security;
alter table public.hashtag_results  enable row level security;
alter table public.content_analysis enable row level security;
alter table public.reports          enable row level security;

-- users: 자기 행 조회/수정
create policy users_select_own on public.users
  for select using (id = auth.uid());
create policy users_update_own on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- api_credentials: 정책 없음 → 클라이언트 전면 차단. service-role(서버)만 접근.

-- categories: 본인 소유 전체 권한
create policy categories_all_own on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tracked_accounts: 본인 소유 전체 권한
create policy tracked_accounts_all_own on public.tracked_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- account_snapshots: 부모(tracked_accounts) 소유자만 SELECT (쓰기는 수집 잡=service-role)
create policy account_snapshots_select_own on public.account_snapshots
  for select using (exists (
    select 1 from public.tracked_accounts ta
    where ta.id = account_snapshots.tracked_account_id and ta.user_id = auth.uid()
  ));

-- media_posts: 부모 소유자만 SELECT
create policy media_posts_select_own on public.media_posts
  for select using (exists (
    select 1 from public.tracked_accounts ta
    where ta.id = media_posts.tracked_account_id and ta.user_id = auth.uid()
  ));

-- post_metrics: 2단계 부모(media_posts→tracked_accounts) 소유자만 SELECT
create policy post_metrics_select_own on public.post_metrics
  for select using (exists (
    select 1 from public.media_posts mp
    join public.tracked_accounts ta on ta.id = mp.tracked_account_id
    where mp.id = post_metrics.media_post_id and ta.user_id = auth.uid()
  ));

-- hashtag_jobs: 본인 것 SELECT (쓰기는 서버=쿼터 enforce)
create policy hashtag_jobs_select_own on public.hashtag_jobs
  for select using (user_id = auth.uid());

-- hashtag_results: 부모(hashtag_jobs) 소유자만 SELECT
create policy hashtag_results_select_own on public.hashtag_results
  for select using (exists (
    select 1 from public.hashtag_jobs hj
    where hj.id = hashtag_results.hashtag_job_id and hj.user_id = auth.uid()
  ));

-- content_analysis: 부모(media_posts→tracked_accounts) 소유자만 SELECT
create policy content_analysis_select_own on public.content_analysis
  for select using (exists (
    select 1 from public.media_posts mp
    join public.tracked_accounts ta on ta.id = mp.tracked_account_id
    where mp.id = content_analysis.media_post_id and ta.user_id = auth.uid()
  ));

-- reports: 본인 것 SELECT (생성은 서버)
create policy reports_select_own on public.reports
  for select using (user_id = auth.uid());
