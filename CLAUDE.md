# CLAUDE.md — Meta SNS 트렌드 분석기

> 이 파일은 Claude Code가 세션 시작 시 자동으로 읽는 **마스터 컨텍스트**다.
> **짧게 유지**하고 상세는 `docs/`로 위임한다 (토큰 절약). 필요할 때만 해당 docs를 열어라.

## 한 줄 정의
광고주(육아용품 매장)에게 제공할 **인스타그램 중심 SNS 트렌드/경쟁 분석기**.
사용자가 자기 Meta API 토큰 + 분석할 외부 계정/해시태그를 입력하면, 공개지표를 수집·분석·리포트한다.

## ⚠️ 절대 잊지 말 핵심 제약 (전체는 `docs/02_CONSTRAINTS.md`)
- Meta API는 **"내 권한 계정" vs "남의 공개 계정"** 이 완전히 다르다.
- **외부 계정의 노출/도달(reach·impressions) = 공식·서드파티 모두 불가.** 위임 계정만 가능.
- 외부 계정의 **조회수(릴스 재생수)·댓글내용 = 서드파티로만 가능 (Phase 4).**
- 외부 계정 **공개지표(좋아요·댓글수·캡션·해시태그·시각) = 공식 API Business Discovery로 가능 (Phase 1).**
- 입력하는 **API 토큰은 "출입증"** 일 뿐. 그 토큰으로 *남의* 공개 계정도 조회한다.
- 해시태그 검색 = **토큰당 7일 30개** 하드 쿼터. 그 외는 시간당 속도 제한(리셋됨).
- Business Discovery는 **상대가 비즈니스/크리에이터 계정일 때만** 동작 (개인계정 ❌).

## 기술 스택 (확정 — 상세 `docs/03_ARCHITECTURE.md`)
- 프론트: **Next.js(React) + Tailwind + shadcn/ui + 차트**, 반응형 + **PWA** (모바일 우선)
- 배포: **Vercel** (화면·가벼운 API)
- 수집 잡: **Supabase Edge Function / cron 배치** (Vercel 서버리스 타임아웃 회피)
- 저장·인증: **Supabase** (Postgres + Auth + Storage + RLS)
- 인증: **익명인증으로 시작 → 배포 전 구글 로그인 교체** (link identity로 데이터 보존)
- API 토큰: **암호화 저장, 호출은 100% 서버사이드** (프론트 노출 금지)

## 역할
- **일반 사용자:** 자기 API 토큰 입력 → 자기 데이터만 조회 (RLS 격리). 평소 오픈(익명인증).
- **마스터(프로젝트 오너):** service-role로 전 사용자 과거기록 전체 조회·조합·재가공.

## Phase 로드맵 (상세 `docs/07_ROADMAP.md`)
1. **Phase 1** 외부계정 공개지표 대시보드 (Business Discovery) + 익명인증 + 토큰 입력
2. **Phase 2** AI 콘텐츠 주제/카피 분석 (캡션 + 미디어)
3. **Phase 3** 위임 계정 완전분석(노출·도달) + 경쟁 비교 리포트 → **MVP 점검 + 구글 로그인 교체**
4. **Phase 4** 서드파티 PoC → 외부 경쟁사 조회수·댓글내용 보강

## 현재 상태
- **Phase 1 + Phase 2(콘텐츠 분석) + Phase 2.5(매장 비교) + Phase 3 핵심(내 계정 노출·도달) 구현 완료(로컬) — 사용자 검수 단계.** `npm run build`/lint 통과.
- **Phase 3 핵심 흐름(D-023):** UI 라벨 **내 계정/외부 계정** 통일. **내 계정**(토큰 주인 본인 1개)은 "내 계정 분석 추가"(`/api/accounts/self`, owned+delegated) 등록 → 수집 시 `fetchOwnedProfile`+`fetchMediaInsights`(per-media 0.25s, 종류별 지표셋·폴백)로 **노출·도달·저장·조회**까지 `post_metrics` 적재(`collectOwnedAccount`, 수집 라우트 access_tier 분기). **일괄**: 목록 체크박스+전체선택+"선택 수집 & 분석"(클라 0.5s orchestrate) + **일일 캐시**(KST 0시 `/collect` `{cached}`) + **강제 갱신**. 비교/대시보드 노출·도달 보강(내 계정만, 외부 추정 금지). **마이그레이션 0**. 후속: 마스터 콘솔·구글 로그인·앱 검수.
- Phase 1 흐름: 등록/수집(`/api/accounts`, `/api/accounts/collect`, `lib/meta/collect.ts`) → 지표/대시보드(`lib/analytics/account-metrics.ts`, `/api/accounts/metrics`, `/accounts/[id]` Recharts) → 해시태그(`lib/meta/hashtag.ts` 7일 롤링 30개 쿼터, `/api/hashtags`, `HashtagCard`).
- Phase 2 흐름: 캡션 **+ 이미지 비전(D-022)**→AI 분석(`lib/ai/content-analysis.ts` 청크 배치, `lib/ai/analyze-account.ts` 증분/재분석, `/api/accounts/analyze`)→`content_analysis`(+`visual_notes`) 적재→대시보드 "콘텐츠 인사이트" 탭(소구점/톤/포맷/키워드/게시물별+비주얼 노트, `/api/accounts/insights`, `lib/analytics/content-insights.ts`). 비전: provider 멀티모달화(`images`/`supportsVision`)+인라인 base64(`lib/ai/fetch-image.ts`), image/carousel=media_url·video/reel=thumbnail, `AI_VISION` 킬스위치(기본 ON). 상세 D-019/D-020/D-022.
- Phase 2.5 비교: 참여율 자동순위(`/api/accounts/ranking`, 공용 로더 `lib/server/account-report.ts`) + 2~5개 매장 → 정량표 + LLM 냉정 평가(`lib/ai/compare-accounts.ts`, `/api/accounts/compare`, `reports(kind='comparison')` 적재, `/compare` 화면). 노출·도달 비교는 Phase 3. 상세 D-021.
- 적재: snapshots/media_posts/post_metrics(외부=노출·도달 null), hashtag_jobs/results, content_analysis(가공). 지표는 조회 시 계산(캐시 안 함, D-016).
- 공용 Supabase(`nushcvgafwqosnkzlsrm`)에 `analyze_insta_*` 테이블 적용. **익명 로그인 ON + service-role 키 입력·검증 완료**.
- **남은 블로커(비차단):** Meta 앱 `META_APP_ID/SECRET` 보류 — 없어도 동작(appsecret_proof·장기토큰 교환만 비활성). AI 분석은 Vertex 자격증명 필요(`/api/ai/ping` 선검증).
- 다음 작업: Phase 2(+이미지 비전, D-022) 검수 피드백 반영 → Phase 3(위임 계정 노출·도달) 착수 판단. ⚠️ 비디오/릴스 비전은 thumbnail_url 필요 → 기존 계정 **재수집** 후 재분석. `docs/07_ROADMAP.md` "다음 할 일" 참조.

## 작업 규칙
- 새 기능/결정을 추가하면 **반드시 관련 docs와 `docs/09_DECISIONS.md`를 갱신**한다.
- 데이터 수집 코드는 항상 **rate limit 헤더 모니터링 + 배치 분산**을 전제로 짠다.
- 토큰·시크릿은 절대 커밋하지 않는다 (`.env.local`, Supabase Vault 사용).
- 외부 계정에 대해 "노출/도달"을 보여주는 UI는 **만들지 않는다** (확보 불가 데이터).

## 빠른 참조
- Meta API 호출법: `/meta-api` 스킬 또는 `docs/05_META_API.md`
- 개발 재개 절차: `/dev-resume` 스킬
- 셋업(처음 환경 구성): `docs/08_SETUP.md` (요약)
- **Supabase 설정 상세 매뉴얼:** `docs/10_GUIDE_SUPABASE.md`
- **Meta 설정 상세 매뉴얼(토큰·비즈니스계정·페이지):** `docs/11_GUIDE_META.md`
