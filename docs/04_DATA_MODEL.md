# 04. 데이터 모델

> 개념 스키마. 실제 마이그레이션 작성 시 Supabase `apply_migration`으로 반영하고 이 문서를 갱신한다.
> 원칙: **raw(원본 수집) / 가공(분석·리포트) 분리**, 모든 사용자 테이블은 **RLS** 적용.

## ⚠️ 테이블 접두사 규칙 (필수)
- **이 Supabase 프로젝트는 공용(여러 프로젝트가 `public` 스키마 공유).**
- 우리가 만드는 **모든 DB 객체에 `analyze_insta_` 접두사**를 붙인다 (소문자).
  - 테이블뿐 아니라 **enum 타입·함수·트리거·인덱스**도 `public` 네임스페이스를 공유하므로 동일 접두사.
  - 예: `analyze_insta_tracked_accounts`, `analyze_insta_user_role`(enum), `analyze_insta_handle_new_user()`.
- 아래 개요/컬럼 설명의 이름은 **가독성을 위해 접두사를 생략**했다. 실제 객체명 = `analyze_insta_` + 이름.

## 테이블 개요
| 테이블 | 구분 | 역할 |
|---|---|---|
| `users` | 인증 | 익명/소셜 사용자, 역할(master/user) |
| `api_credentials` | 시크릿 | 사용자별 Meta 토큰(암호화), ig_user_id |
| `categories` | 메타 | 사용자가 정의한 분석 카테고리(예: 육아용품) |
| `tracked_accounts` | 메타 | 분석 대상 계정(외부/위임), 유형·권한등급 |
| `account_snapshots` | raw | 계정 단위 시계열(팔로워·게시물수) |
| `media_posts` | raw | 게시물 원본(캡션·미디어·타입·시각·permalink) |
| `post_metrics` | raw | 게시물 지표(공개지표 / 위임계정 인사이트) |
| `hashtag_jobs` | raw | 해시태그 조회 이력 + 쿼터 카운터 |
| `hashtag_results` | raw | 해시태그 수집 게시물 |
| `content_analysis` | 가공 | AI 콘텐츠 분석(주제·소구점·포맷·카피톤) |
| `reports` | 가공 | 리포트 캐시 |

## 주요 컬럼 (개념)

### users
- `id` (uuid, = auth.uid), `role` (enum: master|user), `created_at`
- 익명인증 사용자도 여기 매핑. 구글 연결 시 동일 id 유지(link identity).

### api_credentials
- `id`, `user_id` → users, `channel` (enum: instagram|threads|facebook)
- `ig_user_id`, `encrypted_token` (Vault 참조), `token_expires_at`, `created_at`
- ⚠️ 토큰 평문 저장 금지. 서버사이드에서만 복호화.

### categories
- `id`, `user_id`, `name`, `channel`, `created_at`

### tracked_accounts
- `id`, `user_id`, `category_id` → categories
- `channel`, `username`, `ig_id`(있으면)
- `account_kind` (enum: competitor|influencer|owned)
- `access_tier` (enum: **public** | **delegated**)  ← 공개지표 vs 완전분석 분기 핵심
- `created_at`

### account_snapshots  (시계열)
- `id`, `tracked_account_id`, `captured_at`
- `followers_count`, `follows_count`, `media_count`, `biography`

### media_posts
- `id`, `tracked_account_id`, `external_media_id`, `permalink`
- `caption`, `media_type` (image|video|carousel|reel), `posted_at`
- `media_url` (분석용), `raw` (jsonb 원본)

### post_metrics
- `id`, `media_post_id`, `captured_at`
- 공개: `like_count`, `comments_count`
- 위임 전용(nullable): `reach`, `impressions`, `saved`, `video_views`/`plays`, `profile_visits`
- (Phase 4 서드파티): `play_count_3p`, `comment_texts` (jsonb) — 출처 표시 `source`(official|thirdparty)

### hashtag_jobs
- `id`, `user_id`, `credential_id`, `hashtag`, `hashtag_id`
- `requested_at`, `quota_week_start` — **7일/30개 쿼터 추적용**
- `status` (pending|done|quota_blocked)

### hashtag_results
- `id`, `hashtag_job_id`, `external_media_id`, `caption`
- `like_count`, `comments_count`, `media_type`, `permalink`, `raw`
- ⚠️ 작성자(계정) 정보 없음 — Meta가 제공 안 함.

### content_analysis  (가공)
- `id`, `media_post_id`, `model`, `analyzed_at`
- `topic`, `appeal_points` (jsonb), `format`, `tone`, `summary`, `keywords` (jsonb)

### reports  (가공)
- `id`, `user_id`, `category_id`, `kind` (account|hashtag|comparison)
- `payload` (jsonb), `generated_at`

## RLS 정책 개념
- 일반 사용자: 자기 `user_id` 행만 read/write.
- 마스터: service-role(서버사이드)로 전체 접근. 클라이언트엔 노출 안 함.
- `api_credentials`: 클라이언트 직접 접근 금지(서버 함수 경유만).

## 채널 확장
- 모든 핵심 테이블에 `channel` 컬럼 → 쓰레드/페북 추가 시 스키마 재사용.
- 소스 구분 `source`(official|thirdparty) → Phase 4 서드파티 데이터 구분.
