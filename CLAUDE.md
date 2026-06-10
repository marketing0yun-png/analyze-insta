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
- **⭐ 다음 개발 = OAuth 간편 토큰 발급(D-031) — Meta측 셋업 완료·코드 미착수:** 탐색기 수동 발급(STEP 7)을 "Facebook으로 연결" 버튼으로 대체. Facebook Login for Business 구성(`config_id=1407928874437388` → `.env.local` `META_LOGIN_CONFIG_ID`) + 리디렉션 URI(`https://analyze-insta.vercel.app/api/meta/oauth/callback`) 등록 완료. **재개 지점 = `docs/11_GUIDE_META.md` STEP 11 체크리스트 11-4부터:** `public_profile` 고급 액세스(앱 기본정보 `/privacy` URL 등록 선행) → 라우트 2개(`/api/meta/oauth/start`·`/callback`, `exchangeLongLivedToken` 재사용) + ConnectCard 버튼 → 테스터 등록 → Vercel env 3종. 신형 Instagram Login은 Business Discovery·해시태그 미지원으로 기각.
- **모바일 UX 패스(D-032) 완료(로컬):** 모바일 잘림·정보 우선순위 피드백 반영(앱 전환 기각 — 레이아웃 문제). ① **헤더 계정 메뉴**(`layout/account-menu.tsx` — 미로그인=로그인 버튼, 로그인=프로필 버튼+상태 점(초록=개인 토큰/주황=체험), 클릭=모바일 바텀 시트·PC 드롭다운에 로그인 정보+`ConnectCard`+`UsageMeterCard`). ② 토큰 상태 공유 `CredentialsProvider`(`/api/credentials` 단일 조회, layout 장착). ③ 홈 분기: 연결되면 설정 카드 전부 헤더 메뉴로 → **계정 목록 최상단**(미연결 시에만 ConnectCard 온보딩 노출). ④ 계정 목록 행 모바일 2줄(잘림 해결)·비교 리더보드 계정명 break-all. ⑤ 비교 화면 설명 접이식(`<details>`). 마이그레이션 불필요. `lint`/`build`(24라우트) 통과. 상세 `docs/09_DECISIONS.md` D-032.
- **건강점수+비교 미분석 차단+쉬운 설명(D-030) 완료(로컬):** ① 비교 실행 시 미분석 계정 섞이면 **알럿 모달**로 차단(`UnanalyzedWarnModal` — 제외 후 비교 / 닫고 분석). ② **계정 건강점수**(`lib/analytics/health-score.ts`, 반응40·소통20·꾸준함20·확산20 가중합 0~100 *참고* 점수, 내 계정은 도달기반 반응; 정렬은 참여율 유지·건강점수는 배지 병기) — `ranking`·`CompareSummary`에 `reelsSharePct`/`avgReach` 배선, 리더보드·비교표 `HealthBadge`+`HealthLegend`. ③ 오프라인 사장님용 **쉬운 설명**: 공유 `PLAIN_LANGUAGE_RULE`(personas)→3 프롬프트 주입 + 공용 `Glossary`(비교 리더보드·대시보드 푸터). 마이그레이션 불필요. `lint`/`typecheck`/`build`(24라우트) 통과. 상세 `docs/09_DECISIONS.md` D-030.
- **카테고리별 분석 페르소나(D-029) 완료:** 분석 두뇌(LLM 프롬프트 3곳)의 "육아용품" 하드코딩 → **고정 4종 페르소나**(parenting/pet/finance/general)로 전환. `src/lib/ai/personas.ts`에 중앙화(`getPersona`/`PERSONA_LABELS`/`toPersonaCategory`), 3개 프롬프트(content-analysis·compare-accounts·diagnose-account)가 공유. `tracked_accounts.persona_category` 컬럼 신설(마이그레이션 `20260611000001` **공용 적용 완료**, 기존 19계정→parenting 백필). 비교는 `pickComparePersona`(내 계정>벤치마크>다수결>일반). 등록 폼 카테고리=**필수 드롭다운**. `lint`/`typecheck`/`build`(24라우트) 통과. 상세 `docs/09_DECISIONS.md` D-029.
- **비교분석 객관성 고도화 + 단일 전략 진단(D-028) 완료(로컬):** ① 비교 프롬프트를 **절대 등급 기준**으로 고도화(공유 `OBJECTIVITY_RULES`=상대평가·환각 방지, 전원 부진 시 억지 칭찬 금지, 수치 날조 금지, 콘텐츠 아이디어=카테고리 추론 기반) + `commonStrengths`/`commonWeaknesses`(공통 진단)·계정별 `category` 추가(`compare-accounts.ts`/`compare-view`). ② **단일 계정 '전략 진단' 탭**(`lib/ai/diagnose-account.ts` + `GET/POST /api/accounts/strategy`, 분석·비교 미터 1칸, `reports(kind='diagnosis')` 캐시, 대시보드 3번째 탭 `StrategyDiagnosis` 온디맨드). ③ 홈 `CompareHeroCard`(비교 부각 그라데이션 CTA, 계정<2면 비활성 안내). ④ `compare-view` `GradeLegend`(참여율 공식+규모별 기대치+등급 컷 접이식 범례). 마이그레이션 불필요. `lint`/`typecheck`/`build`(24라우트) 통과. 상세 `docs/09_DECISIONS.md` D-028.
- **디자인 리뉴얼(D-027) 완료(로컬):** 전 화면 **인스타 바이브 그라데이션 + 라이트/다크 토글**. 자체 테마(layout no-flash 스크립트 + `ThemeProvider`=`useSyncExternalStore`, `next-themes` 미도입) + 공용 `AppHeader`/`Background`(`layout`) + 프리미티브 교체(Card 글래스·Button 그라데이션 CTA·brand 토큰/유틸 `globals.css`). Badge default는 솔리드 유지(emerald 의미색 보존). 기능 로직 불변. `lint`/`typecheck`/`build`(23라우트) 통과. 상세 `docs/09_DECISIONS.md` D-027.
- **배포 완료 + 익명 폐기→구글 로그인 게이트 + 데모(목업) 모드(D-026) 구현 완료(로컬) — 운영자 Supabase Google OAuth 설정 후 활성화.** `npm run build`/lint 통과.
- **인증 D-026:** 익명인증 자동 생성 제거. **3단계 = 데모(비로그인, 목업만)→체험계정(로그인+오너 토큰, 2h 한도)→개인 토큰(무제한+노출·도달).** `AuthProvider.signInWithGoogle`/`signOut`/`isAuthenticated` + `/auth/callback`(PKCE 교환) + `SignInCard`. 비로그인 홈=`DemoHome` 미리보기, `/accounts/demo`=`lib/demo/demo-data.ts` 목업 대시보드(`AccountDashboard` `demoData` prop). `ConnectCard`에 체험계정(관리자 토큰·횟수 제한) 안내(요청 2). **운영자 잔여:** Supabase Google provider 활성화 + Redirect URL `<origin>/auth/callback`(`docs/12_GUIDE_GOOGLE_LOGIN.md`).
- **Phase 1 + Phase 2(콘텐츠 분석) + Phase 2.5(매장 비교) + Phase 3 핵심(내 계정 노출·도달) + Phase 3.5(미터 코어 D-024 + 잔여 게이트·마스터 콘솔·오너 토큰 폴백 D-025) 구현 완료(로컬) — 사용자 검수 단계.**
- **Phase 3.5 완성(D-025):** 오너 토큰 폴백(`META_OWNER_TOKEN` env → `/collect`가 체험 외부수집 대행 → collect 한도 실발동, 내 계정 노출·도달은 개인 토큰 전용) + 외부 계정 개수 한도(체험3/개인10, `getExternalAccountUsage`) + 해시태그 체험=신청/개인=검색(+큐레이션, `analyze_insta_hashtag_requests`/`_curated_hashtags`) + 안내 UI(LLM비용·혼잡·비교용1회) + **마스터 콘솔**(`/master`·`GET/POST /api/master`, `lib/server/master.ts` `isMaster`=`MASTER_EMAILS`/`MASTER_USER_IDS`) + **구글 로그인 스캐폴딩**(`AuthProvider.linkGoogle`/`GoogleLinkCard`, Supabase OAuth 설정만 잔여 — `docs/12_GUIDE_GOOGLE_LOGIN.md`). 마이그레이션 `20260610000001` 공용 적용 완료. **후속(범위 밖):** Claude provider 정식·Meta 검수·Vercel·크레딧.
- **Phase 3.5 미터 코어(D-024):** `analyze_insta_usage_events`(+enum, 공용 프로젝트 적용) + `lib/server/usage-meter.ts`(2시간 슬라이딩 윈도우, 티어=본인 credential 유무, `getMeterStatus`/`recordUsage`/`getAllMeters`/`meterBlockedMessage`) + 게이트(`/collect` 실수집만·`/analyze` 첫 청크만 LLM 1회·`/compare`) + `GET /api/usage` + 홈 `UsageMeterCard`(실시간 카운트다운). **2미터:** 수집·지표(체험 5/2h·개인 무제한, `/metrics` 무계측) / 분석·비교(두 티어 5/2h 공용).
- **Phase 3 핵심 흐름(D-023):** UI 라벨 **내 계정/외부 계정** 통일. **내 계정**(토큰 주인 본인 1개)은 "내 계정 분석 추가"(`/api/accounts/self`, owned+delegated) 등록 → 수집 시 `fetchOwnedProfile`+`fetchMediaInsights`(per-media 0.25s, 종류별 지표셋·폴백)로 **노출·도달·저장·조회**까지 `post_metrics` 적재(`collectOwnedAccount`, 수집 라우트 access_tier 분기). **일괄**: 목록 체크박스+전체선택+"선택 수집 & 분석"(클라 0.5s orchestrate) + **일일 캐시**(KST 0시 `/collect` `{cached}`) + **강제 갱신**. 비교/대시보드 노출·도달 보강(내 계정만, 외부 추정 금지). **마이그레이션 0**. 후속: 마스터 콘솔·구글 로그인·앱 검수.
- Phase 1 흐름: 등록/수집(`/api/accounts`, `/api/accounts/collect`, `lib/meta/collect.ts`) → 지표/대시보드(`lib/analytics/account-metrics.ts`, `/api/accounts/metrics`, `/accounts/[id]` Recharts) → 해시태그(`lib/meta/hashtag.ts` 7일 롤링 30개 쿼터, `/api/hashtags`, `HashtagCard`).
- Phase 2 흐름: 캡션 **+ 이미지 비전(D-022)**→AI 분석(`lib/ai/content-analysis.ts` 청크 배치, `lib/ai/analyze-account.ts` 증분/재분석, `/api/accounts/analyze`)→`content_analysis`(+`visual_notes`) 적재→대시보드 "콘텐츠 인사이트" 탭(소구점/톤/포맷/키워드/게시물별+비주얼 노트, `/api/accounts/insights`, `lib/analytics/content-insights.ts`). 비전: provider 멀티모달화(`images`/`supportsVision`)+인라인 base64(`lib/ai/fetch-image.ts`), image/carousel=media_url·video/reel=thumbnail, `AI_VISION` 킬스위치(기본 ON). 상세 D-019/D-020/D-022.
- Phase 2.5 비교: 참여율 자동순위(`/api/accounts/ranking`, 공용 로더 `lib/server/account-report.ts`) + 2~5개 매장 → 정량표 + LLM 냉정 평가(`lib/ai/compare-accounts.ts`, `/api/accounts/compare`, `reports(kind='comparison')` 적재, `/compare` 화면). 노출·도달 비교는 Phase 3. 상세 D-021.
- 적재: snapshots/media_posts/post_metrics(외부=노출·도달 null), hashtag_jobs/results, content_analysis(가공). 지표는 조회 시 계산(캐시 안 함, D-016).
- 공용 Supabase(`nushcvgafwqosnkzlsrm`)에 `analyze_insta_*` 테이블 적용. service-role 키 입력·검증 완료. **인증=구글 로그인(D-026)** — Supabase Google provider 활성화 + Redirect URL `<origin>/auth/callback` 등록은 운영자 잔여.
- **남은 블로커(비차단):** ~~Meta 앱 시크릿 보류~~ → **`META_APP_ID/SECRET` `.env.local` 입력 완료(2026-06-10)** — appsecret_proof·장기토큰 교환 활성(Vercel env 등록은 잔여). AI 분석은 Vertex 자격증명 필요(`/api/ai/ping` 선검증).
- 다음 작업: **OAuth 간편 토큰 발급 구현(D-031, `docs/11_GUIDE_META.md` STEP 11)** → Phase 2(+이미지 비전, D-022) 검수 피드백 반영 → Phase 3(위임 계정 노출·도달) 착수 판단. ⚠️ 비디오/릴스 비전은 thumbnail_url 필요 → 기존 계정 **재수집** 후 재분석. `docs/07_ROADMAP.md` "다음 할 일" 참조.

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
