---
name: meta-api
description: Meta(Instagram) Graph API 호출 빠른참조 — Business Discovery, Hashtag Search, Insights 엔드포인트와 레이트리밋/쿼터. 인스타 데이터 수집 코드를 짜거나 디버그할 때 사용.
---

# Meta Graph API 빠른참조

상세는 `docs/05_META_API.md`. 여기는 코딩 중 즉시 참조용 요약.

## 토큰 흐름
1. FB 로그인(scope: instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement)
2. `GET /me/accounts` → 페이지 + 페이지 토큰
3. `GET /{page-id}?fields=instagram_business_account` → **ig_user_id**
4. 장기 토큰(~60일) 교환, 만료 전 갱신

## 외부 공개지표 (Phase 1)
```
GET /{ig_user_id}?fields=business_discovery.username(TARGET){
  followers_count,media_count,biography,
  media{caption,like_count,comments_count,media_type,timestamp,permalink,media_url}}
```
→ 대상은 비즈니스/크리에이터만. 노출/도달/댓글내용 없음.

## 해시태그 (Phase 1 보조)
```
GET /ig_hashtag_search?user_id={ig_user_id}&q=KEYWORD  → hashtag_id
GET /{hashtag_id}/recent_media?user_id={ig_user_id}&fields=caption,like_count,comments_count,media_type,permalink,timestamp
```
→ ⚠️ 토큰당 7일 30개 고유 태그. 작성자·조회수 없음. DB 카운터로 사전 차단.

## 위임 계정 인사이트 (Phase 3)
```
GET /{ig_user_id}/insights?metric=reach,impressions,profile_views&period=day
GET /{media_id}/insights?metric=reach,impressions,saved,video_views
GET /{ig_user_id}/media?fields=caption,media_type,timestamp,permalink
```
→ 본인 권한 계정만. 노출·도달·저장·조회·댓글내용 가능.

## 레이트리밋
- 일반: BUC 시간당 제한. `X-Business-Use-Case-Usage` 헤더 모니터링 + 배치 분산.
- 해시태그: 7일/30개 하드 쿼터.
- 토큰: ~60일 만료.

## 절대 규칙
- 호출은 100% 서버사이드. 토큰 프론트 노출 금지.
- 외부 계정에 노출/도달 UI 만들지 않기(확보 불가).
- 개인(비즈니스 미전환) 계정은 조회 불가.
- 일반 공개 배포는 앱 검수 + 비즈니스 인증 필요.
