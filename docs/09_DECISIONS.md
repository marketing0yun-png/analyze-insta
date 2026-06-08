# 09. 의사결정 로그 (ADR)

> 왜 이렇게 정했는지 기록. 결정이 바뀌면 새 항목 추가(기존 항목은 남기고 "변경됨" 표시).

## D-001. 인스타그램 집중 우선
- **결정:** MVP는 인스타그램만. 쓰레드·페북 보류.
- **이유:** 외부 계정 분석 실현성이 인스타 ≫ 쓰레드 > 페북. 페북은 CrowdTangle 종료로 외부분석 거의 불가, 쓰레드는 외부 API 미성숙.
- **날짜:** 2026-06-05

## D-002. 외부 계정 데이터는 공식 API(공개지표)부터
- **결정:** Phase 1은 Business Discovery 기반 공개지표만. 스크래핑 미사용.
- **이유:** 합법·안정. 노출/도달은 어차피 불가, 조회수·댓글내용은 서드파티(Phase 4)로 분리.
- **날짜:** 2026-06-05

## D-003. 서드파티는 검증 후 도입 (Phase 4)
- **결정:** 공식 API로 MVP 완성 후, 필요성 확인되면 서드파티 PoC.
- **이유:** 약관 회색지대·비용·안정성 리스크를 MVP 가치 검증 후 평가.
- **날짜:** 2026-06-05

## D-004. 노출/도달은 위임 계정에만
- **결정:** 외부 계정에 노출/도달 UI를 만들지 않는다. 위임(owned) 계정만 완전분석.
- **이유:** reach/impressions는 Meta 비공개값으로 소유자만 접근. 어떤 방법으로도 외부 확보 불가.
- **날짜:** 2026-06-05

## D-005. 권한 혼합 모델
- **결정:** 광고주 일부는 계정 권한 위임(완전분석), 나머지(경쟁사·인플루언서)는 공개지표.
- **이유:** 현실적으로 전체 위임 불가. `access_tier`(public|delegated)로 데이터·UI 분기.
- **날짜:** 2026-06-05

## D-006. 스택: Next.js + Vercel + Supabase, 반응형 PWA
- **결정:** 단일 코드베이스 반응형+PWA(모바일 우선). 수집 잡은 Supabase로 분리.
- **이유:** 웹/모바일 따로 안 만들어도 됨. Vercel 서버리스 타임아웃 회피 위해 수집은 Edge Function/cron.
- **날짜:** 2026-06-05

## D-007. 인증: 익명 시작 → 구글 교체
- **결정:** 익명인증으로 개발/오픈, 배포 전 구글 로그인으로 link. 카카오는 후속 옵션.
- **이유:** 토큰 입력 서비스라 최소 식별 필요. 구글이 즉시 사용·검수 부담 적음. 카카오는 동의항목 검수 관문.
- **날짜:** 2026-06-05

## D-008. 토큰 보안: 서버사이드 전용·암호화
- **결정:** Meta 토큰은 암호화 저장, 호출은 서버사이드만, 프론트 노출 금지.
- **이유:** 사용자 토큰 위탁 → 탈취·오용 방지 책임.
- **날짜:** 2026-06-05

## D-009. 문서 구조: CLAUDE.md(짧게) + docs/(상세)
- **결정:** 마스터 컨텍스트는 CLAUDE.md, 상세는 docs/ 번호순. 스킬로 빠른참조.
- **이유:** 매 세션 자동로드 토큰 절약 + 개발 재개 편의.
- **날짜:** 2026-06-05

## D-010. Phase 0 스택 구현 세부 (착수 시 확정)
- **결정:** Next.js 16(App Router) + Tailwind v4 + shadcn/ui(new-york, neutral) + Recharts.
  익명인증은 **클라이언트(`AuthProvider`)에서 1회 `signInAnonymously`**, 세션 갱신은 proxy.
- **이유/주의:**
  - Next 16에서 `middleware` 컨벤션 deprecated → **`src/proxy.ts`** 사용.
  - `lucide-react` v1은 **브랜드 아이콘(Instagram 등) 제거** → 일반 아이콘(`TrendingUp`)으로 대체.
  - 익명 로그인을 미들웨어가 아닌 클라이언트에서 하는 이유: 크롤러/봇 요청마다 anon 유저가
    양산되는 것을 피하고, proxy는 세션 유지/갱신만 담당.
  - **env 미설정에도 앱이 뜨도록 graceful degrade**(proxy·AuthProvider 모두 env 가드).
- **날짜:** 2026-06-05

## D-011. 공용 Supabase 프로젝트 재사용 (신규 생성 안 함)
- **결정:** 전용 프로젝트를 새로 만들지 않고 기존 **"marketing0yun's Project"(`nushcvgafwqosnkzlsrm`)** 를 공유. 모든 객체에 `analyze_insta_` 접두사.
- **이유:** 동일 오너의 여러 프로젝트가 한 Supabase에 공존(01marketing_*, p02_*, key_* 등). 비용·관리 단순화. 접두사로 네임스페이스 충돌 회피.
- **주의:** `public` 스키마 공유라 다른 앱과 RLS·확장(pgcrypto) 영향 공유. 마이그레이션 추가 시 접두사 필수.
- **날짜:** 2026-06-06

## D-012. 토큰 암호화: AES-256-GCM 대칭암호화 (Vault 전 단계)
- **결정:** Supabase Vault 도입 전까지 `TOKEN_ENCRYPTION_KEY`(32바이트 base64)로 **AES-256-GCM** 암호화. 저장 포맷 `v1:<iv>:<ct>:<tag>`. 복호화·호출은 server-only.
- **이유:** Vault 설정 전에도 평문 저장 금지 원칙(docs/06 §2) 충족. GCM은 무결성(인증태그) 포함. 운영 키는 Vercel 시크릿으로 분리.
- **변경 여지:** 추후 Supabase Vault로 이관 가능(포맷 버전 `v1` 으로 마이그레이션 대비).
- **날짜:** 2026-06-06

## D-013. ig_user_id 추출: /me/accounts 첫 IG 비즈니스 계정 선택
- **결정:** 토큰 검증 시 `GET /me/accounts?fields=...instagram_business_account{...}` 에서 IG 비즈니스 계정이 연결된 **첫 페이지**를 자동 선택. 여러 개면 개수를 사용자에게 알리되 첫 번째 사용.
- **이유:** MVP 단순화. 다중 계정 선택 UI는 실제 다계정 사용자 등장 시 추가.
- **부분 미설정 graceful:** Meta 앱 시크릿 없으면 appsecret_proof·장기토큰 교환만 건너뛰고 토큰 검증·저장은 동작. service-role 없으면 저장 단계서 503 안내.
- **날짜:** 2026-06-06

## D-014. 토큰 스코프에 `business_management` 필수 (새 페이지 환경 대응)
- **결정:** 토큰 발급 권장 스코프를 4개로 확정 — `instagram_basic`, `pages_show_list`, `pages_read_engagement`, **`business_management`**. 가이드(docs/11 STEP 6·7)에 반영.
- **이유(실전 검증):** 요즘 페이스북 페이지는 **새 페이지 환경(New Pages Experience) + 비즈니스 관리**로 생성된다. `business_management` 없이는 `GET /me/accounts` 가 `{"data": []}` 빈 배열을 반환해(페이지를 ID로 직접 조회하면 `instagram_business_account` 가 정상으로 나오는데도 목록 열거에 안 잡힘) D-013의 ig_user_id 추출이 실패한다. 권한 4개를 모두 부여하면 정상 열거.
- **추가 함정:** 탐색기 토큰 발급 시 동의 팝업에서 **"계속"이 아니라 "설정 수정"** 으로 들어가 페이지·IG·비즈니스 **옵트인**을 명시적으로 해야 한다(건너뛰면 동일 증상). 또 토큰 계정이 해당 페이지의 **관리자**여야 하고, **개인 프로필↔IG 연결이 아니라 페이지↔IG 프로페셔널 연결**이어야 한다.
- **코드 영향:** 현행 `resolveInstagramUser`(`/me/accounts` 의존)는 토큰에 `business_management` 가 포함되면 그대로 동작. 향후 견고화를 원하면 빈 배열 시 `/me/businesses → owned_pages/client_pages` 폴백 추가 검토(미적용).
- **날짜:** 2026-06-08

## D-015. Business Discovery 수집: 온디맨드 Next route 우선 (배치는 Edge Function 으로 추후)
- **결정:** Phase 1 수집기를 **단일 계정 온디맨드**로 Next.js route(`/api/accounts/collect`)에 구현. 여러 계정 정기 수집(배치/cron)은 추후 Supabase Edge Function 으로 분리.
- **이유:** 단건 Business Discovery 호출은 가볍고 Vercel 타임아웃 위험이 없어(D-006 의 타임아웃 회피 취지에 부합) 즉시 검증·사용 가능. 배치는 rate limit 분산·재시도가 필요해 별도 잡으로 빼는 게 적절.
- **구조:** 수집 로직은 `lib/meta/collect.ts`(`collectTrackedAccount`)로 분리해 route 와 향후 Edge Function 이 **공유**. 소유권은 RLS 클라이언트로 검증 후, 토큰 복호화·raw 적재는 service-role 로 수행.
- **적재 대상:** `account_snapshots`(시계열) + `media_posts`(upsert) + `post_metrics`(source=official). 외부 계정이므로 reach/impressions/saved 등은 항상 null(D-004).
- **날짜:** 2026-06-08

## D-016. 지표 계산은 클라이언트 호출용 순수함수 + 조회 시 on-the-fly 계산 (캐시 안 함)
- **결정:** 참여율·업로드 빈도·시간대/요일·포맷 비중을 `lib/analytics/account-metrics.ts` **순수함수**로 분리하고, `/api/accounts/metrics` 가 RLS 로 raw 를 읽어 **요청 시마다 계산**해 반환. `reports` 테이블 캐시는 아직 쓰지 않음.
- **이유:** 게시물 25개 규모라 계산이 가벼워 캐시 불필요. 순수함수 분리로 추후 서버/배치/테스트 재사용 + 정의 일원화. 시간대/요일은 **KST(UTC+9) 고정** 환산(국내 광고주 대상).
- **변경 여지:** 데이터·계정 수 증가 시 `reports` 캐시(kind='account')로 이관.
- **날짜:** 2026-06-08

## D-017. 계정 대시보드는 전용 라우트 `/accounts/[id]` (단일 페이지 인라인 아님)
- **결정:** 분석 대시보드를 랜딩 인라인 확장이 아닌 **전용 동적 라우트**로. 차트는 Recharts(파이=포맷, 바=시간대/요일) + 상위 게시물 리스트. 모바일 우선 카드 그리드.
- **이유:** 차트가 많아 인라인은 비좁음. 라우트 분리로 딥링크·뒤로가기 자연스럽고, 향후 비교 리포트(Phase 3) 라우트와 일관.
- **날짜:** 2026-06-08

## D-018. 해시태그 7일 쿼터는 롤링 고유-태그 카운트로 사전 enforce
- **결정:** "토큰당 7일 30개 고유 해시태그" 한도를 `hashtag_jobs` 에서 **최근 7일 롤링 distinct(hashtag)** 로 세어 30개 도달 시 새 태그 조회를 429 로 사전 차단. 7일 내 이미 조회한 태그의 재조회는 쿼터 미소비로 허용.
- **이유:** Meta 쿼터는 롤링 7일 기준이라 고정 주차(week_start)만으로는 부정확. distinct 카운트가 실제 한도와 일치. 사전 차단으로 불필요한 API 소모·차단 응답 회피(docs/05 §3).
- **주의:** `ig_hashtag_search` 호출 자체도 쿼터를 소비하므로 검색 전에 카운트한다. `quota_week_start` 컬럼은 기록용(조회일)으로만 채움.
- **날짜:** 2026-06-08

## D-019. AI 분석은 프로바이더 추상화 + 1차 구현체 Gemini(Vertex AI)
- **결정:** Phase 2 AI 분석을 특정 모델 SDK에 직결하지 않고 **프로바이더 인터페이스**(`lib/ai/`)로 추상화. 1차 구현체는 **Gemini 2.5 Flash(Vertex AI)**, 활성 프로바이더·모델은 env(`AI_PROVIDER`/`GEMINI_MODEL`)로 결정. 향후 `providers/claude.ts`를 같은 인터페이스로 추가하고, 정식 단계에 "사용자별 선택"으로 확장.
- **이유:** Vertex AI 무료 크레딧으로 베타까지 저비용 검증 → 정식 때 Claude 전환 또는 사용자 선택을 **설정 한 줄 문제**로 만든다. 결과 스키마(주제·소구점·포맷·카피톤)를 모델 중립 JSON으로 고정해 모델 교체 시 과거 데이터·대시보드 호환 유지.
- **구조:** `types.ts`(모델 중립 타입) + `provider.ts`(인터페이스) + `providers/gemini.ts`(Vertex 구현) + `index.ts`(`getAIProvider()` 셀렉터). 호출·DB 적재·UI는 인터페이스에만 의존.
- **인증/보안:** Meta 토큰(사용자 입력)과 달리 AI 키는 **오너가 서버에 1개 보유**(서비스계정). 로컬은 `GOOGLE_APPLICATION_CREDENTIALS`(키 파일, **repo 밖** `~/.gcp/`), Vercel은 `GOOGLE_VERTEX_CREDENTIALS_JSON`(인라인) 폴백. 자격증명·호출 100% server-only(D-008 원칙 동일).
- **함정(실전 검증):** Gemini 2.5 계열은 기본 thinking 활성 → `maxOutputTokens`가 작으면 출력이 빈 문자열. `thinkingBudget`으로 제어(점검 ping은 0). location 기본 `global`. 연결 점검: `GET /api/ai/ping`(2026-06-08 `reply:"네"` 검증).
- **변경 여지:** 정식 단계에 Claude provider 추가 + 사용자별 프로바이더/키 선택. 키 1개→사용자 입력 모델은 그때 결정.
- **날짜:** 2026-06-08

## D-020. 콘텐츠 분석 파이프라인 = 캡션 텍스트 + 청크 배치 + 증분 적재
- **결정:** Phase 2 분석 파이프라인을 **(1) 입력=캡션+포맷+참여지표 텍스트**(이미지 비전 제외), **(2) 청크 10개 단위 배치 호출**(json 모드, `responseMimeType`), **(3) 증분 적재**(미분석 게시물만, `reanalyze=true` 시 전체)로 구현. 결과는 D-019의 모델 중립 `ContentAnalysis`(주제·소구점·포맷·톤·요약·키워드)로 고정.
- **구조:** `lib/ai/content-analysis.ts`(프롬프트·파싱, provider 인터페이스에만 의존) + `lib/ai/analyze-account.ts`(수집 게시물→분석→`content_analysis` 적재, service-role) + `lib/analytics/content-insights.ts`(순수 집계) + `POST /api/accounts/analyze` / `GET /api/accounts/insights` + 대시보드 "콘텐츠 인사이트" 탭.
- **이유(이미지 제외):** 현 provider 인터페이스(`generateText`)는 텍스트 전용. 멀티모달은 추상화 확장(이미지 파트 전달)이 필요 → 핵심 인사이트("어떤 소구점이 반응이 좋은가")는 캡션만으로 충분히 도출되므로 우선 텍스트로 출시하고 비전은 후속 과제로 분리.
- **이유(청크·증분):** 25~30개를 한 번에 보내면 출력 누락·토큰 폭주 위험 → 10개 청크로 신뢰성 확보. 파싱은 id 우선·순서 폴백으로 모델의 id 변형/누락 방어. 증분은 재호출 비용을 막고(이미 분석분 건너뜀), 멱등 적재(대상 기존행 삭제 후 삽입)로 `content_analysis` 의 media_post_id 유니크 제약 없이도 중복을 방지.
- **레이트/비용:** 분석은 온디맨드(수집과 동일, D-015 사상). `maxDuration=60`. 토큰 사용량은 `AnalyzeAccountResult` 로 반환(모니터링).
- **변경 여지:** 멀티모달 provider 확장 시 입력에 미디어 추가. 배치 분석 Edge Function 분리(D-015와 함께). `content_analysis` 에 unique(media_post_id) 제약을 두면 upsert 로 단순화 가능.
- **날짜:** 2026-06-08

## D-021. 매장 비교 분석(Phase 2.5) = 참여율 자동순위 + LLM 냉정평가, 공개지표 한정
- **결정:** Phase 3의 "비교 리포트" 중 **공개지표 기반 N:N 비교**를 Phase 2.5로 앞당겨 구현. 잘/못 나가는 판정은 **참여율((좋아요+댓글)/팔로워) 자동 순위**. 2~5개 계정을 골라 정량 비교표 + **LLM 냉정 평가**(강점·약점·개선책)를 받는다. 노출·도달 비교는 위임 계정 한정 Phase 3에 그대로 남긴다.
- **벤치마크 사용자 지정:** "따라잡을 목표(벤치마크)" 매장은 **비교할 때마다 사용자가 직접 지정**(`benchmarkIds`, 영구 플래그 아님). 이유: 같은 매장이 한 비교에선 목표, 다른 비교에선 개선 대상이 될 수 있어("잘↔우리 / 잘↔못 / 못↔우리") 계정 단위 고정 플래그는 부적합. 지정 시 LLM 프롬프트가 각 계정을 '벤치마크 목표/개선 대상'으로 표시하고, opportunities·recommendations·contentIdeas 를 **개선 대상이 목표에 도달하는 방향**으로 생성. 미지정이면 참여율 순 자동 비교로 폴백. 전부 벤치마크면 개선 대상이 없어 무시. DB 변경 없음(per-comparison, payload.benchmark_ids 로만 기록).
- **구조:** 공용 로더 `lib/server/account-report.ts`(계정별 지표+콘텐츠인사이트 1회 로드, metrics/insights 라우트와 동일 임베드 쿼리를 한 곳으로) + `lib/ai/compare-accounts.ts`(요약·순위·비교 프롬프트·모델중립 `ComparisonReport`) + `GET /api/accounts/ranking`(참여율 리더보드) + `POST /api/accounts/compare`(비교+평가, `reports(kind='comparison')` 적재) + `/compare` 화면(`compare-view.tsx`).
- **참여율 등급(규모 보정):** 절대 %만 보면 비즈니스·대형 계정을 부당하게 '낮다'고 오해함 → `lib/analytics/engagement-benchmark.ts`로 **팔로워 규모별 기대치** 대비 등급화(활발/양호/평균/다소 낮음). 색상 배지+기대치 눈금 미터(`components/accounts/engagement-badge.tsx`)로 대시보드·리더보드·비교표에 일관 노출. LLM 프롬프트에도 등급을 주입해 환각·오판 방지.
- **분석→액션:** 단순 진단에서 끝내지 않도록 `ComparisonReport`에 전반 `opportunities`(기회·다음 액션)와 매장별 `contentIdeas`(시도할 구체 콘텐츠) 추가. "이왕 토큰 쓴 김에 실질 도움" 원칙.
- **이유(공개지표 한정):** 외부 경쟁사는 노출·도달이 원천 불가(D-004) → 비교를 공개지표+콘텐츠전략으로 한정하고, 프롬프트에 "없는 지표 추정 금지"를 명시해 환각을 막는다. 참여율은 팔로워 보정으로 규모 차이를 흡수해 비교 기준으로 적합.
- **이유(앞당김):** 데이터·인프라(reports 테이블·AI 추상화·집계 순수함수)가 이미 있어 신규 인프라 0. "단일 분석"만으론 '왜 우리가 밀리나'가 안 보여 비교 수요가 즉각적.
- **재사용/적재:** content_analysis 결과가 없으면 비교가 무의미 → 최소 1개 분석 존재를 요구. 평가 이력은 reports 에 payload(summaries+report) 통째 저장(마스터 재가공·D-005 대비).
- **변경 여지:** 위임 계정 노출·도달을 포함한 완전 비교(Phase 3). 카테고리 단위 자동 비교(우리 vs 카테고리 평균). 사용자 라벨('우리/벤치마크') 보강.
- **날짜:** 2026-06-08

## D-022. 이미지 비전 분석 = 프로바이더 인터페이스 멀티모달 확장(인라인 base64) + visualNotes
- **결정:** D-020의 후속(이미지 비전)을 구현. AI 프로바이더 인터페이스를 텍스트 전용에서 **멀티모달**로 확장 — `GenerateTextOptions.images?: ImagePart[]`(인라인 base64) + `AIProvider.supportsVision`. 콘텐츠 분석 시 게시물 이미지를 캡션과 함께 넘겨 `ContentAnalysis.visualNotes`(시각 요소: 피사체·제품·연출·색감·구도·텍스트오버레이)를 추가로 뽑는다. `content_analysis.visual_notes` 컬럼 신설(마이그레이션 `20260608000001_vision.sql`).
- **이유(인라인 base64):** Vertex AI 의 Gemini 는 임의 HTTP URL 을 직접 fetch 하지 못하고(gs:// 만), 인스타 CDN URL 은 만료된다 → 서버에서 바이트를 받아 base64 인라인으로 전달(`lib/ai/fetch-image.ts`). 모델 중립을 위해 `ImagePart{mimeType,data}` 만 인터페이스에 둔다(Claude 등도 동일 형태로 매핑 가능).
- **이미지 소스:** image/carousel = `media_url`(이미지). video/reel = `raw.thumbnail_url`(Business Discovery `thumbnail_url` 필드 추가, 정지 썸네일) — 비디오 `media_url` 은 동영상 파일이라 인라인 비전 불가. 썸네일 없으면 그 게시물은 **캡션만** 분석(graceful). 기존 수집분은 thumbnail_url 이 없으니 **재수집해야 비디오 비전이 채워짐**.
- **청크 내 매칭:** 청크(10개) 중 이미지가 있는 게시물만 1-based 첨부 순번을 부여하고 프롬프트의 `[이미지] 첨부됨 — N번째` 마커로 모델이 이미지↔게시물을 연결(일부만 이미지가 있어도 견고). fetch 실패/타입 불일치/상한(4MB) 초과는 null 로 흡수해 분석을 막지 않는다.
- **비용 제어:** 이미지는 토큰 비용이 크므로 **env 킬스위치 `AI_VISION`(기본 ON)** + 요청별 `vision` 플래그로 끌 수 있다. provider 가 비전 미지원이면 값과 무관하게 캡션만 분석. 분석 결과에 `imagesAnalyzed`(실제 첨부된 이미지 수) 반환해 모니터링.
- **변경 여지:** sharp 등으로 업로드 전 리사이즈(현재는 4MB 상한 스킵만). 캐러셀 다중 이미지(현재 커버 1장). 비교(2.5) 프롬프트에 시각 인사이트 집계 주입. Claude provider 의 비전 매핑.
- **날짜:** 2026-06-08

## D-023. 내 계정 완전분석(노출·도달) = 본인 ig_user_id 직접 조회 + per-media insights + 일일 캐시
- **결정:** Phase 3 핵심을 구현. "위임/delegated" 대신 **UI 라벨을 "내 계정"(노출·도달까지) / "외부 계정"(공개지표만)** 으로 통일(DB 값 `account_kind='owned'`·`access_tier='delegated'`는 유지, 라벨만). 내 계정은 **토큰 주인 본인 계정 1개**(토큰당 1개)로 한정.
- **수집 경로 분기:** 외부=Business Discovery(공개지표, 계정당 1콜) / 내 계정=`fetchOwnedProfile`(본인 ig_user_id 직접 노드 조회 — follows_count 포함) + 게시물마다 `fetchMediaInsights`(노출·도달·저장·조회). **내 계정은 반드시 cred.ig_user_id(본인)를 조회** — 남의 계정에 인사이트 호출 금지(인스타가 본인 계정에만 인사이트 제공, D-004). `collectOwnedAccount`가 `post_metrics`에 reach/impressions/saved/video_views/plays 적재(source='official').
- **위임의 실제 의미(혼동 방지):** 비밀번호가 아니라 **토큰(출입증)**을 받는 것. 광고주가 본인 계정으로 직접 토큰을 발행·동의해 토큰값만 입력하면, 그 토큰으로 **본인 계정의** 노출·도달까지 조회 가능. 등록은 `POST /api/accounts/self`가 cred에서 토큰 복호화→`resolveInstagramUser`로 username 재해석→owned+delegated로 insert(또는 기존 행 승격). 이렇게 ig_user_id 일치를 보장.
- **레이트리밋/페이싱:** 외부 1콜은 무시할 수준 → 일괄 시 계정 사이 0.5s(클라). 내 계정은 게시물 수만큼 인사이트 콜이 나가 버스트 → per-media 0.25s 페이싱(`OWNED_INSIGHT_DELAY_MS`). 인사이트 호출은 종류별 지표셋 시도→실패 시 최소셋(reach,saved) 폴백→그래도 실패면 공개지표만(throw 안 함). `monitorRateLimit` 헤더 경고 유지.
- **일괄 + 일일 캐시:** 목록 체크박스 + 전체선택 + **"선택 수집 & 분석"**(클라가 계정별 `/collect`→`/analyze` 순차 호출 → Vercel 60초/요청 한도 회피). **일일 캐시:** 최신 스냅샷 `captured_at >= 오늘 0시(KST)`면 `/collect`가 Meta 호출 없이 `{cached:true}` 반환(AI 토큰·API 쿼터 절약). **"강제 갱신"** 체크박스가 `force:true`로 캐시 무시(새 게시물 즉시 반영). 분석은 기존 증분이라 새 게시물 없으면 비용 0.
- **분석 60초 한도(핵심 함정):** 게시물 30개를 한 요청에서 분석하면 ~100초(비전 포함)로 **Vercel 60초/요청 한도에 걸린다(로컬은 한도 없어 통과하므로 못 느낌)**. → `/analyze`를 **한 요청당 10개(=content-analysis CHUNK_SIZE)** 만 처리하고 `remaining` 반환, **클라 공용 헬퍼(`lib/client/analyze-loop.ts`)가 remaining 0 될 때까지 반복 호출**. 각 요청 ~35초로 한도 내. **퀄리티 동일**(AI는 원래도 10개씩 청크 호출 — `content-analysis.ts` CHUNK_SIZE=10, 청크 간 컨텍스트 공유 없음 → HTTP 요청을 쪼개도 입력이 동일). `reanalyze`는 첫 호출만 보내 서버가 **1회 전체 리셋** 후 증분으로 남은 청크 처리. 일괄·인사이트 탭 양쪽이 같은 헬퍼 사용.
- **분석중 UX/ETA:** "분석중" 인지가 쉽도록 진행 배너(계정 N/M + 게시물 done/total + 진행바 + 예상 남은 시간)와 **시작 전 안내**(계정당 약 100~120초, 예상 총합, "탭 닫지 마세요" confirm) 제공. ETA는 계정당 ~110초·청크당 ~35초 경험치. 한계: 클라 orchestrate라 **탭을 닫으면 중단**(완료분은 저장) → 진짜 백그라운드는 Edge Function(D-015) 후속.
- **비교/대시보드 보강:** `account-metrics`에 avgReach/avgImpressions/avgSaved/avgVideoViews(값 있는 게시물만 평균, 외부=null) + TopPost에 reach/impressions. 대시보드는 delegated일 때 "내 계정 인사이트(노출·도달)" 카드. 비교는 `CompareSummary.avgReach/avgImpressions`(내 계정만 채움) + 프롬프트에 "노출·도달은 내 계정에만 — 외부는 추정 금지" + 정량표 도달 열(내 계정만).
- **마이그레이션 0:** `post_metrics`에 reach/impressions/saved/video_views/plays/profile_visits, snapshots에 follows_count, enum에 owned/delegated가 이미 존재(D-010 init) → **스키마 변경 없이 채우기만**.
- **범위(이번):** 내 계정 인사이트 + 일괄/캐시 + 비교 보강까지. **마스터 콘솔·구글 로그인·Meta 앱 검수는 후속**(검수는 휴대폰 인증 보류로 외부 차단).
- **변경 여지:** 중첩 필드(`media{insights.metric(...)}`)로 인사이트 호출 1~2회로 축소(종류별 지표 차이로 fragile, 현재는 개별+폴백). 계정 인사이트(period 기반 reach·profile_views). 배치 수집 Edge Function 분리(D-015).
- **날짜:** 2026-06-08

## D-024. 프리미엄 티어 + 사용량 미터 (Phase 3.5, 운영 레이어) — 코어 구현
- **결정:** 베타를 **무료로 운영하되 비용을 방어**하고 **개인(Meta) 토큰 발급을 유도**하는 2티어 모델을 Phase 3.5(가로 운영 레이어)로 분리한다. **티어 판별 = 사용자에게 개인 토큰이 등록돼 있는지** (오너 토큰만이면 체험, 개인 토큰 있으면 개인).
- **구현 상태(2026-06-09, build/lint 통과):** 미터 코어 완료. `analyze_insta_usage_events`(+enum `usage_action`) 테이블(공용 프로젝트 적용), `lib/server/usage-meter.ts`(`resolveTier`/`getMeterStatus`/`recordUsage`/`getAllMeters`/`meterBlockedMessage`, 2시간 슬라이딩 윈도우·resetAt 계산), 게이트 `/collect`·`/analyze`·`/compare`, `GET /api/usage`, 홈 `UsageMeterCard`(실시간 카운트다운). **분석 청크 과금:** 클라 `first` 플래그로 첫 청크만 LLM 1회 차감(계정 1개=LLM 1회), 연속 청크·이미 분석된 no-op 은 무과금. **수집 과금:** 일일 캐시 히트는 무과금(Meta 미호출), 실수집 성공만 1칸.
- **⚠️ 선결 과제(오너 토큰 폴백):** 현재 `/collect`·`/analyze` 가 *본인* credential 을 요구 → 사실상 전원 `personal` 티어로 판정되어 **collect 체험 한도가 아직 발동하지 않는다**. "체험 유저가 오너 토큰으로 수집"을 구현해야 collect 게이트가 실효를 가진다(미터 인프라는 그대로 재사용). LLM 게이트는 티어 무관 동일 한도라 지금도 정상 동작.
- **잔여:** 외부 계정 개수 한도(3/10) 게이트, `/accounts/self`·`/hashtags` 개인 토큰 전용 차단, 기능별 비활성 안내 UI, LLM 비용·혼잡 안내 문구, 해시태그 신청 테이블, 크레딧 충전.
- **두 개의 별도 미터(둘 다 "최근 2시간 N회" 슬라이딩 윈도우, 누적 없음):**
  - **수집·지표 미터(Meta·무료, 오너 쿼터 보호/시간할당량):** 체험 2시간 5회 / 개인 무제한. **실질 게이트는 `/collect` 한 곳뿐.** 수집은 LLM을 안 쓰므로 비용이 아니라 **오너 토큰의 Meta 쿼터(시간당 공유 물통)**를 막는 용도. 지표(`/metrics`)는 Meta·LLM 둘 다 안 쓰고 적재된 raw 계산만 하므로 **조회는 공짜·무계측** — 새 데이터가 필요할 때 수집할 때만 미터를 소비한다. 차등의 본질은 "얼마나 자주 재수집(최신화)하느냐"이고, 이미 받아둔 지표를 들여다보는 건 양 티어 모두 자유(멈춰있는 숫자라 막을 이유가 없음). 개인 토큰이면 재수집도 무제한.
  - **분석·비교 미터(LLM·비용 방어):** 체험·개인 **모두 2시간 5회 공용**(콘텐츠 인사이트 분석과 비교분석이 한 풀을 공유). *분석·비교만 LLM을 쓴다(수집·지표는 안 씀).* **개인 토큰이어도 안 풀림** — LLM 실비용은 토큰 주인이 아니라 **운영자가 부담**하므로 Meta 토큰 유무와 무관. **추후 유료화 대상도 이 분석·비교 미터뿐**, 수집·지표는 계속 무료.
- **티어별 능력 한도:** 외부 계정 체험 3 / 개인 10. **내 계정 노출·도달은 개인 토큰만**(오너 토큰으론 남의 계정 인사이트가 물리적으로 불가 — D-023). 해시태그는 개인 토큰만 직접 검색(7일/30개 쿼터가 토큰당이라 공유 불가, D-018), 체험은 **신청**만.
- **슬라이딩 윈도우 근거:** "2시간마다 +1 적립(누적)"이 아니라 **쓴 시각 기준 2시간 뒤 재충전**. 예: 08:34 사용 → 10:34 가능. 구현 = 사용 시각만 기록하고 "최근 2시간 내 횟수 < 한도"로 판정. 한도 5면 5번 중 가장 오래된 사용이 2시간 지나면 1칸 회복. UI는 실제 갱신 시각 + 실시간 카운트다운.
- **참여형 해시태그:** 체험 유저는 `(날짜·키워드·user_id)`로 **신청**을 적재 → 마스터가 일별 최다 신청을 **주 30개 쿼터 내**(하루 ~4개)로 추가 → 결과는 공통 노출(호기심 후크). 개인 토큰 유저는 본인 검색 개인화 추가. 해시태그 인기게시물은 작성자 정보가 없어(Meta 미제공) "왜 인기?"는 캡션·포맷·참여 기반 AI 분석으로 본다.
- **혼잡 안내 = 전환 유도:** 오너 토큰 공유로 **수집**이 느려질 수 있을 때 "개인 토큰을 연결하면 더 빠르게 수집" 안내. (느려지는 건 LLM이 아니라 Meta 수집 쪽 — 물통 공유.)
- **LLM 비용 투명 안내:** 분석에 AI가 쓰여 관리자 실비용 발생 → 테스트 기간 무료(관리자 전액 부담)·과도 비용 방어 위한 제한 양해·추후 사용량 완화 검토·테스트 종료 후 모델 업그레이드 예정을 사용자에게 고지.
- **크레딧 충전(검토):** 쿠팡파트너스는 **구매 발생 시에만** 수익(클릭만으론 0) + 대가성 표시 의무 → "클릭=크레딧"은 미끼 구조. **애드센스 인센티브 클릭은 정책 위반(정지)** → 보상은 정식 보상형 광고/행동 보상으로. 모바일 앱 단계에서 본격화.
- **연관(D-007/Phase 3):** "복붙" 토큰 입력은 단계가 많아 이탈률이 높음 → **페이스북 로그인(OAuth)** 으로 개인 토큰 자동 발급이 정석. 단 공개용은 **Meta 앱 검수 + 비즈니스 인증** 필요(현재 보류) → 베타=복붙, 공개=OAuth.
- **구현 범위:** 사용 이력 테이블 + 해시태그 신청 테이블(마이그레이션) + 다수 라우트 게이트 + UI(카운트다운·안내·비활성). 특정 기능이 아닌 **전 기능 위에 얹히는 층**이라 별도 Phase(3.5)로 분리.
- **날짜:** 2026-06-09

---
## 미해결/추후 결정
- [ ] 로그인 프로바이더 최종 확정(구글 단독 vs 구글+카카오) — 현재 구글 우선 가정.
- [ ] 서드파티 공급사 선정(Phase 4 시점).
- [ ] 일반 공개 vs 테스터 한정 운영(앱 검수 진행 여부).
