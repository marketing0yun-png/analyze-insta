# 05. Meta Graph API 참조

> 실제 호출 시 필드/제한은 Meta가 종종 바꾸므로 **착수 시점에 공식 문서 재확인**.
> 빠른 참조용 요약. 호출 규칙은 `/meta-api` 스킬에도 동일 요약 있음.

## 0. 전제
- **Facebook 개발자 앱** + 비즈니스 인증, 분석 주체 IG는 **비즈니스/크리에이터 계정** + FB 페이지 연결.
- 모든 호출은 **서버사이드**. 토큰 노출 금지.
- 베이스 URL: `https://graph.facebook.com/<version>/`

## 1. 토큰 발급 흐름
1. Facebook 로그인(OAuth) → 권한 동의.
   - 스코프(예): `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`
2. `GET /me/accounts` → 연결된 FB 페이지 목록 + 페이지 access token
3. `GET /{page-id}?fields=instagram_business_account` → **ig_user_id** 획득 (모든 호출의 열쇠)
4. 단기 토큰 → **장기 토큰(~60일)** 교환, 만료 전 갱신.

## 2. 핵심 엔드포인트

### (A) 외부 계정 공개지표 — Business Discovery  [Phase 1]
```
GET /{ig_user_id}
    ?fields=business_discovery.username(TARGET_USERNAME){
        followers_count, media_count, biography, name, username, profile_picture_url,
        media{ caption, like_count, comments_count,
               media_type, media_product_type, timestamp, permalink,
               media_url, thumbnail_url,
               children{id,media_type,media_url,thumbnail_url} } }
```
- 반환: 대상(남의) 공개 비즈니스 계정의 지표 + 최근 게시물.
- 제약: 대상이 비즈니스/크리에이터여야 함. **노출/도달/댓글내용 없음.**
- children(캐러셀 낱장)은 콘텐츠 연구용으로 `media_posts.raw` 에 함께 적재(D-030 후속).

### (B) 해시태그 검색 — Hashtag Search  [Phase 1 보조]
```
1) GET /ig_hashtag_search?user_id={ig_user_id}&q=육아   → hashtag_id
2) GET /{hashtag_id}/top_media?user_id={ig_user_id}
       &fields=id,caption,like_count,comments_count,media_type,media_url,
               children{id,media_type,media_url},permalink,timestamp
       &limit=25
   (또는 /recent_media = 시간순)
```
- ⚠️ **쿼터: 토큰당 7일 30개 고유 해시태그.** 카운터를 `hashtag_jobs`로 추적.
- 기본 **top_media(메타 인기순 블랙박스) 상위 25개.** media_url·children 적재(`hashtag_results.raw`, D-030 후속).
- 반환에 **작성자 정보 없음, 조회수·썸네일 없음**(thumbnail_url 은 해시태그 엣지 미지원).

### (C) 위임 계정 인사이트 — Insights  [Phase 3]
```
계정: GET /{ig_user_id}/insights?metric=reach,impressions,profile_views,...&period=day
게시물: GET /{media_id}/insights?metric=reach,impressions,saved,video_views,...
미디어 목록: GET /{ig_user_id}/media?fields=caption,media_type,timestamp,permalink
```
- 반환: **노출·도달·저장·조회·프로필방문 등 비공개 인사이트** + 댓글내용 접근 가능.
- 단, **본인이 권한 가진 계정에만** 동작.

## 2.5 가져올 수 있는 필드 — 한눈 정리
> 참여율·콘텐츠 분석에 쓰는 "수집 가능 항목" 확정표. 외부/해시태그/내 계정으로 갈린다.

### (A) 외부 계정 (남의 공개 계정) — Business Discovery
**전제:** 대상이 **비즈니스/크리에이터 계정**일 때만 (개인계정 ❌).

| 구분 | 필드 | 가능 | 비고 |
|---|---|---|---|
| 계정 | username, name, biography | ✅ | biography = 프로필 소개 글 |
| 계정 | **followers_count** (팔로워) | ✅ | 참여율 분모 |
| 계정 | follows_count (팔로잉) | ✅ | |
| 계정 | media_count (총 게시물 수) | ✅ | |
| 계정 | profile_picture_url, website | ✅ | 프사 이미지 주소 / 소개란 링크 |
| 게시물 | **like_count** (좋아요 수) | ✅ | 주인이 좋아요 숨기면 0/누락 |
| 게시물 | **comments_count** (댓글 수) | ✅ | 개수만(내용 ❌) |
| 게시물 | caption (본문 글) | ✅ | 콘텐츠 분석 핵심 재료 |
| 게시물 | media_type (IMAGE/VIDEO/CAROUSEL) | ✅ | |
| 게시물 | media_url / thumbnail_url | ✅ | 영상은 media_url=mp4, thumbnail_url=표지컷 |
| 게시물 | permalink, timestamp | ✅ | 링크 · 게시 시각 |
| 게시물 | children (캐러셀 낱장) | ✅ | 낱장별 url·type 수집(raw 적재). 좋아요·댓글은 게시물 단위 |
| — | 리포스트·조회수·도달·노출·저장·공유 | ❌ | 공식 불가(릴스 조회·리포스트는 Phase 4 서드파티) |
| — | 댓글 *내용* | ❌ | 개수만 |

→ **외부 참여율 = (좋아요 + 댓글) ÷ 팔로워.** 공식 API로 만들 수 있는 전부.

### (B) 해시태그 검색 — Hashtag Search (보조)
| 필드 | 가능 | 비고 |
|---|---|---|
| caption, like_count, comments_count | ✅ | |
| media_type, permalink, timestamp | ✅ | |
| **media_url, children(낱장)** | ✅ | 콘텐츠 연구용 raw 적재(D-030 후속) |
| thumbnail_url | ❌ | 해시태그 엣지 미지원 |
| **작성자(username)** | ❌ | 누가 올렸는지 없음 |
| 조회수·도달 | ❌ | |

→ ⚠️ **쿼터 7일 30개 고유 태그(토큰당). 기본 top_media(인기순) 상위 25개.**

### (C) 내 계정 (위임/본인 토큰) — Insights
외부에서 막히던 비공개 지표가 여기선 열린다.

| 구분 | 필드 | 가능 |
|---|---|---|
| 게시물 | 좋아요·댓글 | ✅ |
| 게시물 | **reach (도달)** | ✅ |
| 게시물 | **views (조회수)** ※구 impressions 전환 | ✅ |
| 게시물 | **saved (저장)** | ✅ |
| 게시물 | **shares (공유)** | ✅ |
| 게시물 | total_interactions, 릴스 재생/시청 | ✅ |
| 계정 | reach, profile_views, accounts_engaged | ✅ |
| 계정 | 팔로워 증감, 오디언스(도시·연령·성별) | ✅ (팔로워 100+ 시) |

→ **내 계정 참여율 = (좋아요+댓글+저장+공유) ÷ 도달** 처럼 정확히 계산 가능.
→ 건강점수가 내 계정만 **도달기반 반응**으로 분기하는 이유(D-030).

**요약:** 외부 = 좋아요·댓글·팔로워·캡션·포맷·시각까지 / 내 계정 = 도달·노출·저장·공유까지. 참여율 신뢰도 차이가 여기서 갈린다.

## 3. 레이트리밋 / 쿼터
| 항목 | 내용 | 대응 |
|---|---|---|
| 일반 호출 | Business Use Case 시간당 제한(연결 계정수 비례). 넘으면 지연 | `X-Business-Use-Case-Usage` 헤더 모니터링, 배치 분산 |
| 해시태그 | **7일/30개 고유 태그(토큰당)** | DB 카운터로 사전 차단 |
| 토큰 | 장기 ~60일 만료 | 만료 전 자동 갱신 |
| 페이지네이션 | 최근 게시물 중심, 무한 과거 회수 어려움 | "최근 N개" 기준 분석 |

## 4. 권한 등급 (앱 검수)
- **개발 모드:** 앱에 역할 등록된 계정(본인·테스터)만 동작.
- **일반 공개:** `instagram_basic` 등 **Advanced Access** 필요 → **앱 검수 + 비즈니스 인증** 통과.
- → MVP는 개발모드로 만들고, 배포 단계에서 검수 진행(`docs/07_ROADMAP.md` Phase 3 말미).

## 5. 못 가져오는 것 (UI에서 약속 금지)
- 외부 계정: 노출/도달(영영 불가), 조회수·댓글내용(공식 불가 → Phase 4 서드파티).
- 개인(비즈니스 미전환) 계정 일체.

## 6. 채널별
- **쓰레드:** Threads API — 내 계정 발행/인사이트 위주. 외부 분석 제한. (보류)
- **페북:** 내 페이지 인사이트만 현실적. 외부 분석 사실상 불가(CrowdTangle 종료). (보류)
