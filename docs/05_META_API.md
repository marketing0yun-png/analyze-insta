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
        followers_count, media_count, biography,
        media{ caption, like_count, comments_count,
               media_type, timestamp, permalink, media_url } }
```
- 반환: 대상(남의) 공개 비즈니스 계정의 지표 + 최근 게시물.
- 제약: 대상이 비즈니스/크리에이터여야 함. **노출/도달/댓글내용 없음.**

### (B) 해시태그 검색 — Hashtag Search  [Phase 1 보조]
```
1) GET /ig_hashtag_search?user_id={ig_user_id}&q=육아   → hashtag_id
2) GET /{hashtag_id}/recent_media?user_id={ig_user_id}
       &fields=caption,like_count,comments_count,media_type,permalink,timestamp
   (또는 /top_media)
```
- ⚠️ **쿼터: 토큰당 7일 30개 고유 해시태그.** 카운터를 `hashtag_jobs`로 추적.
- 반환에 **작성자 정보 없음, 조회수 없음.**

### (C) 위임 계정 인사이트 — Insights  [Phase 3]
```
계정: GET /{ig_user_id}/insights?metric=reach,impressions,profile_views,...&period=day
게시물: GET /{media_id}/insights?metric=reach,impressions,saved,video_views,...
미디어 목록: GET /{ig_user_id}/media?fields=caption,media_type,timestamp,permalink
```
- 반환: **노출·도달·저장·조회·프로필방문 등 비공개 인사이트** + 댓글내용 접근 가능.
- 단, **본인이 권한 가진 계정에만** 동작.

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
