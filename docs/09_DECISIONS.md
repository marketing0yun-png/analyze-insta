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

## D-025. Phase 3.5 잔여 게이트 완성 + 마스터 콘솔 + 오너 토큰 폴백
- **결정:** D-024의 선결 과제와 잔여 게이트를 모두 구현하고, Phase 3의 마스터 콘솔을 추가한다. 외부 의존(구글 로그인·Meta 검수·Vercel)은 **코드 스캐폴딩 + 가이드**까지만(활성화는 운영자 작업).
- **오너 토큰 폴백(선결 과제 해소):** 오너(운영자) 본인 토큰을 env(`META_OWNER_TOKEN`, 선택 `META_OWNER_IG_USER_ID`)로 주입(`getOwnerMetaToken`). `/collect`가 **본인 credential 우선, 없으면(체험) 오너 토큰으로 외부 공개지표 수집을 대행**한다. 이로써 체험 티어가 실제 collect 경로를 타고 **2시간 5회 한도가 발동**한다(개인=무제한). ⚠️ **내 계정(delegated) 노출·도달은 오너 토큰으로 물리적 불가**(남의 인사이트 조회 금지, D-023) → 체험은 명시적으로 차단하고 개인 토큰 연결을 안내. 오너 토큰 미설정 시 체험 수집은 비활성(개인 토큰 유도). `igUserId` 미지정이면 런타임 `resolveInstagramUser`로 1회 해석.
- **외부 계정 개수 한도:** `ACCOUNT_LIMITS`(체험 3 / 개인 10). `/api/accounts` POST가 `getExternalAccountUsage`(service-role 카운트, `account_kind != 'owned'`)로 사전 차단(409). service-role 미설정 등 예외는 경고만 남기고 통과(개발 편의).
- **해시태그 티어 분기:** `/hashtags` POST가 개인 토큰 없으면 직접 검색 대신 `analyze_insta_hashtag_requests`에 **신청**(202)을 적재. GET은 티어별로 `quota/jobs`(개인) + **공통 큐레이션**(`analyze_insta_curated_hashtags`, 모든 티어) + 본인 신청 이력을 반환. 마이그레이션 `20260610000001_hashtag_requests.sql`(공용 프로젝트 적용 완료). 큐레이션 RLS = 인증 사용자 전체 SELECT, 쓰기는 service-role(마스터)만.
- **마스터 콘솔:** 식별 = env 화이트리스트(`MASTER_EMAILS` 1순위 / `MASTER_USER_IDS` 익명단계 임시), `lib/server/master.ts`의 `isMaster`. `GET /api/master`(사용자 수·개인토큰 수·사용량 2h/24h·계정 종류별·신청 대기·큐레이션) + `POST`(add_curated / fulfill_request[+큐레이션] / reject_request) 모두 service-role. `/master` 페이지는 권한 없으면 403 메시지. 둘 다 비어 있으면 누구도 마스터 아님(안전 기본값).
- **안내 UI:** `UsageMeterCard`에 LLM 비용(베타 무료·관리자 부담)·혼잡(수집 지연→개인 토큰 유도)·**"비교용 1회 남기기"**(분석·비교 공용 풀, 잔여 ≤1 시) 문구. 해시태그 카드 체험 모드(신청 버튼·큐레이션·신청 이력). 내 계정 체험 수집 차단 메시지.
- **구글 로그인 스캐폴딩:** `AuthProvider`에 `linkGoogle`(`linkIdentity({provider:'google'})`)·`isAnonymous` 노출 + 익명 세션 한정 `GoogleLinkCard`. **활성화는 Supabase 대시보드 Google OAuth 설정 필요**(docs/12_GUIDE_GOOGLE_LOGIN.md). 미설정 시 버튼이 에러를 그대로 표시.
- **범위 밖(후속):** Claude provider 정식 추가(새 의존성·API 키 — 정식 단계), Meta 앱 검수(휴대폰 인증 보류), Vercel 연결, 크레딧 충전.
- **날짜:** 2026-06-09

---
## D-026. 익명인증 폐기 → 구글 로그인 게이트 + 데모(목업) 모드
- **결정:** 배포 후, **익명인증 자동 생성을 폐기**하고 구글 로그인을 실제 이용의 관문으로 둔다. 로그인 전(로그아웃) 방문자는 **고정 목업(데모)** 만 보고, 모든 실기능(토큰 연결·수집·분석·비교·해시태그)은 로그인 후에만 가능하다.
- **3단계 모델:** ① **데모(비로그인)** — 세션 없이 목업만 열람(조작 불가). ② **체험계정(로그인 + 개인 Meta 토큰 미연결)** — 관리자(오너) 토큰으로 이용, 2시간 한도. ③ **개인 토큰(로그인 + 본인 토큰 연결)** — 수집·지표 무제한 + 내 계정 노출·도달. 티어 판별 로직은 D-024 그대로(본인 credential 유무).
- **AuthProvider 변경:** `signInAnonymously()` 제거. `getUser()` 결과로 ready(user|null) 결정 — user 있으면 로그인, 없으면 데모. `signInWithGoogle()`(`signInWithOAuth({provider:'google', redirectTo:<origin>/auth/callback})`) + `signOut()` + `isAuthenticated` 노출. 기존 `linkGoogle`/`isAnonymous`/`GoogleLinkCard` 폐기(익명 보존 마이그레이션 불필요 — 베타 테스터 소수).
- **OAuth 콜백:** `/auth/callback` route(`exchangeCodeForSession`) 추가 — PKCE code→세션 교환 후 홈 리다이렉트. Supabase Redirect URL 에 `<origin>/auth/callback` 등록 필요.
- **데모 목업:** `lib/demo/demo-data.ts`(육아용품 매장 시나리오 — 내 계정 1 + 경쟁사 2, 노출·도달 포함). 홈 비로그인 = `DemoHome`(사용량·계정 미리보기 "예시" 배지 + `/accounts/demo` 진입). 대시보드 `AccountDashboard`에 `demoData` prop(있으면 API 호출 없이 렌더 + 데모 배너, 인사이트 탭은 로그인 유도). `/accounts/[id]`에서 id="demo" 분기.
- **체험계정 인지(요청 2):** `ConnectCard`에 미연결(=체험) 시 "체험계정으로 이용 중 — 관리자(오너) 토큰으로 이용, 사용 횟수 제한" 경고 박스. 개인 토큰 연결 유도.
- **카피 정리:** 익명 관련 안내·에러 문구를 "로그인 필요/구글 로그인"으로 일괄 교체(`SetupStatus`는 ready 시 숨김, 5개 API 401 메시지, AccountsCard).
- **범위 밖(운영자 작업):** Supabase Google OAuth 활성화 + Redirect URL 등록(docs/12). 미설정 시 로그인 버튼이 에러를 그대로 표시.
- **날짜:** 2026-06-09

---
## D-027. 전 화면 디자인 리뉴얼 — 인스타 바이브 + 라이트/다크 토글
- **결정:** shadcn 기본(무채색) 테마를 벗고 **인스타그램 시그니처 그라데이션(핑크→퍼플→오렌지)** 기반 디자인 시스템으로 전 화면을 통일. 라이트·다크 둘 다 지원 + 상단 토글. 기능/로직은 그대로, **시각 레이어만** 교체.
- **토큰(`globals.css`):** primary/ring 를 비비드 마젠타(oklch)로, 배경·카드·보더에 미세한 보라 틴트. 라이트/다크 양쪽 팔레트. 공용 그라데이션 변수 `--gradient-brand`/`--gradient-brand-soft` + 유틸 `.text-gradient-brand`(배경클립 텍스트)·`.bg-gradient-brand(-soft)`·`.ring-gradient-brand`(mask 기반 그라데이션 테두리). 차트 색도 브랜드 팔레트로(대시보드 하드코딩 hex 교체: 포맷/시간대/요일 차트).
- **테마 방식:** `next-themes` 미도입(의존성 추가 회피). 자체 구현 — layout `<head>`의 **no-flash 인라인 스크립트**가 하이드레이션 전 `.dark` 적용(localStorage `theme` → 없으면 `prefers-color-scheme`). `ThemeProvider`는 `useSyncExternalStore`로 `<html>.dark`(외부 상태)를 **구독만**(effect/synchronous setState 회피 — lint 규칙 `react-hooks/set-state-in-effect` 준수). `ThemeToggle`은 CSS `dark:` 변이로 해/달 아이콘 회전 전환, 라벨만 `suppressHydrationWarning`.
- **공용 셸:** `AppHeader`(sticky 글래스 바 + 그라데이션 로고 타일 + 토글 + 하단 그라데이션 라인)와 `Background`(고정 `-z-10` 인스타 컬러 블러 메시 3개)를 `layout`에 배치 → 모든 페이지 공통.
- **프리미티브:** `Card`=글래스(`bg-card/80 backdrop-blur`)+`rounded-2xl`+호버 섀도. `Button` `default`=**브랜드 그라데이션 CTA**(+active scale·brightness 호버). `Input`=`rounded-lg`+브랜드 포커스링. **`Badge` `default`는 솔리드 primary 유지**(그라데이션 X) — 이유: 그라데이션은 `background-image`라 `bg-emerald-600`(연결됨/내 계정/진행중 배지) 같은 `background-color` 오버라이드를 덮어버려 의미색이 깨짐. 색-vs-색은 tailwind-merge가 정상 병합.
- **화면별:** 홈=그라데이션 히어로(+로드맵 카드 그라데이션 넘버칩/진행중 ring). 로그인 카드=`ring-gradient-brand` + 풀폭 lg CTA. 대시보드 StatCard 리파인 + 차트 브랜드색. 비교/마스터 헤더=그라데이션 아이콘 타일. 다크모드 미흡했던 amber/engagement 배지에 `dark:` 변이 추가.
- **검증:** `npm run lint`/`typecheck`/`build`(23 라우트) 통과.
- **라이트 대비 보정(후속):** 다크가 기본으로 떠 라이트 모드 가독성이 약하다는 피드백 반영. 라이트 토큰 강화 — `--foreground` 0.21→0.18, `--muted-foreground` 0.52→0.448(전역 보조텍스트 또렷), `--primary`/`--ring` 0.58→0.515(마젠타 액센트·text-primary 대비↑), `--border` 0.90→0.882. 헤딩 그라데이션은 흰 배경에서 흐릿한 오렌지를 뺀 `--gradient-brand-text`(핑크→퍼플)로 분리 + 클립 미지원 폴백 색. 라이트 배경 글로우 강도 ↓(텍스트 영역 클린 유지, 다크는 유지). 다크 팔레트 불변.
- **날짜:** 2026-06-09

---
## D-028. 비교분석 객관성 고도화 + 단일 계정 전략 진단 + 부각·기준표
- **배경(사용자 피드백 4건):** ① 비교분석이 좋은 기능인데 디자인적으로 묻힘. ② 평가가 비교군 내 **상대평가**라, 대상이 전부 허접하면 '그중 1등'을 강점으로 포장하는 환각 우려 → **객관(절대 등급) 기준** 강제 필요. ③ 참여율 순위만 보여주고 **공식·등급 기준표**가 없어 반발감. ④ 개별 분석에도 강점/약점/개선책+아이디어를 원함.
- **② 프롬프트 객관성(`lib/ai/compare-accounts.ts`):** 공유 가드레일 `OBJECTIVITY_RULES` 신설 — "강점/약점은 비교 순위가 아니라 **각 계정의 절대 등급(활발/양호/평균/다소 낮음)**을 1차 근거로. 전원이 부진하면 strengths 짧게/비워도 됨(억지 칭찬 금지). 개선책은 이 매장 기준 객관·현실적, **데이터에 없는 수치 날조 금지**. 콘텐츠 아이디어는 게시물로 **카테고리 추론 → 그 카테고리에서 구조적으로 잘 통하는 포맷·소재** 기준(모르는 실시간 유행 날조 금지)". `ComparisonReport`에 `commonStrengths`/`commonWeaknesses`(비교대상 **전원** 공통 진단), `AccountVerdict`에 `category`(추론 카테고리 한 줄) 추가. UI(`compare-view`)에 "비교군 공통 진단" 블록 + 계정별 카테고리 라인.
- **④ 단일 계정 전략 진단(신규):** `lib/ai/diagnose-account.ts`(`diagnoseAccount` — `OBJECTIVITY_RULES` 공유, 비교 대상 없이 **절대 등급만**으로 category/강점/약점/개선책/아이디어). `GET/POST /api/accounts/strategy`(GET=캐시 조회+미터 상태, POST=LLM 실행). **분석·비교 미터(llm) 1칸** 소비(`getMeterStatus`/`recordUsage`) — 비교와 동일 풀. 결과는 `reports(kind='diagnosis')`에 적재·캐시(payload.account_id 로 조회, **시각 컬럼은 `generated_at`**). 대시보드 3번째 탭 **'전략 진단'**(`StrategyDiagnosis`, 온디맨드 '전략 진단 실행' 버튼 + '다시 진단'). 인사이트=관찰된 사실 / 전략 진단=판단·처방으로 탭 분리. 데모·미분석은 안내만.
- **① 부각(`CompareHeroCard`):** 홈 로그인 영역에 그라데이션 히어로 카드(`bg-gradient-brand`) — 계정 2개 이상이면 "비교 시작" CTA, 미만이면 보이되 비활성 + "2개 이상 등록하면 열려요(현재 N개)" 안내. `AccountsCard` 헤더의 기존 소형 버튼은 유지(빠른 진입). `home-section` AccountsCard 아래 배치.
- **③ 기준표(`compare-view` `GradeLegend`):** 정량 비교표 하단에 접이식(`<details>`) 범례 — 공식 `참여율(%) = (좋아요+댓글) ÷ 팔로워 × 100` + 규모별 기대치표(1만 미만 4% / 1만~10만 2.5% / 10만~100만 1.5% / 100만+ 1%) + 등급 컷(활발 2배↑ / 양호 1배↑ / 평균 0.5배↑ / 다소 낮음 0.5배 미만). `engagement-benchmark.ts` 와 동일 기준 하드코딩(표시 전용).
- **마이그레이션:** 불필요 — `reports.kind` 는 `text`(체크 제약 없음), 진단 결과는 기존 `payload` jsonb 안에서 처리.
- **검증:** `npm run lint`/`typecheck`/`build`(24 라우트, `/api/accounts/strategy` 추가) 통과.
- **날짜:** 2026-06-09

---
## D-029. 카테고리별 분석 페르소나(고정 4종) — 육아 전용 탈피
- **배경:** 분석의 "두뇌"(LLM 시스템 프롬프트) 3곳(`content-analysis`·`compare-accounts`·`diagnose-account`)이 "한국 육아용품 매장 전략가/분석가"로 **하드코딩**돼 다른 업종엔 색안경이 끼었다. 수집·지표·해시태그 인프라는 원래 카테고리 무관.
- **결정:** `{카테고리}` 통칭 템플릿 대신 **고정 4종 페르소나를 완전 하드코딩**한다(카테고리마다 타깃·소구점·잘 통하는 콘텐츠·규제가 달라 통칭은 품질 저하). 4종 = **parenting(육아/출산)·pet(반려동물)·finance(금융/보험)·general(일반)**. 금융/보험은 광고 규제(수익률·보장 단정 금지·고지 의무)를 페르소나에 명시 → 규제 소지 콘텐츠를 강점이 아닌 위험으로 지적.
- **중앙화:** `src/lib/ai/personas.ts`에 4 페르소나(`roleNoun`+`domainContext`)를 모으고 `getPersona`/`toPersonaCategory`/`PERSONA_LABELS` 제공. 3개 프롬프트가 공유(내용은 하드코딩, 정의 위치만 단일화 — 12벌 중복 방지). 각 프롬프트는 `"당신은 {roleNoun}의 SNS 마케팅 분석가/전략가입니다" + domainContext`로 조립하고, "위 카테고리 맥락을 평가 기준으로 삼으라" 지시.
- **저장:** `analyze_insta_tracked_accounts.persona_category`(text, 기본 'general', CHECK 4값) 컬럼 신설. 마이그레이션 `20260611000001_persona_category.sql` — **공용 프로젝트 적용 완료**(기존 19개 계정 → 'parenting' 백필). 자유텍스트 `categories`/`category_id` 기존 메커니즘은 건드리지 않고 분리 유지.
- **배선:** `AccountReport.account.persona_category` 추가(`account-report` 로드 시 정규화) → `summarizeForCompare`가 `CompareSummary.personaCategory`로 전달. `analyzeTrackedAccount`는 계정 행에서 직접 조회해 `analyzeContent({category})`로. `/api/accounts`·`/api/accounts/self` POST 가 `persona_category` 수용·검증·적재(self 는 promote 시도 갱신).
- **비교 페르소나 선택(`pickComparePersona`):** 비교는 여러 계정을 한 프롬프트에 넣으므로 평가자 관점 1개 필요 → **내 계정(owned) > 벤치마크 > 다수결 > 일반**(동률·혼재 시 잘못된 도메인 편향 회피로 'general'). `compareAccounts(summaries, persona?)` 가 미지정 시 이 규칙으로 폴백.
- **UI:** `AccountsCard` 등록 폼의 자유텍스트 카테고리 입력을 **필수 드롭다운(4종)**으로 교체 — 외부 계정 추가·내 계정 추가 모두 카테고리 미선택 시 버튼 비활성. 안내 문구로 "AI 페르소나 결정 — 실제 업종 선택" 명시.
- **검증:** `npm run lint`/`typecheck`/`build`(24 라우트) 통과 + 마이그레이션 적용·백필 확인.
- **날짜:** 2026-06-09

---
## D-030. 계정 건강점수 + 비교 미분석 차단 + 오프라인 사장님용 쉬운 설명
- **배경(사용자 피드백 3건):** ① 비교분석으로 바로 진입해 **미분석 계정**을 끼운 채 비교를 돌려 크레딧이 낭비됨(안내문구는 있었으나 차단 없음). ② 참여율 단일 지표의 신뢰도 한계(저장·공유·바이럴·도달 누락) — 보조지표 필요. ③ 사용자는 인스타에 익숙치 않은 **오프라인 매장 사장님** — 쉬운 설명이 필요하되 장황하면 가독성↓.
- **① 비교 미분석 차단(`compare-view`):** '비교 분석' 클릭 시 선택 중 `analyzedPosts===0` 계정이 하나라도 있으면 실행을 막고 **알럿 모달**(`UnanalyzedWarnModal`, 백드롭+blur)로 인지시킴. 액션 = "미분석 제외하고 비교"(미분석·해당 벤치마크 제거 후 2개↑면 즉시 비교, 미만이면 에러 안내) / "닫고 먼저 분석하기". `runCompare(ids, benches)`를 명시 인자형으로 리팩터(stale state 회피). 기존 인라인 안내(amber 박스·`⚠ AI 분석 필요`)는 유지.
- **② 계정 건강점수(`lib/analytics/health-score.ts`):** 추가 수집 없이 4축 가중합 **0~100 참고 점수**(절대 점수 아님 명시). 반응(참여율÷규모 기대치, **내 계정은 도달기반 참여율로 자동 교체**)·소통(댓글비중 댓글÷(좋아요+댓글))·꾸준함(주당 업로드)·확산(릴스 비중). 결측 축은 가중에서 빼고 재정규화. 등급 70↑ 좋음/45↑ 보통/그 미만 주의. **정렬 기준은 참여율 유지**(사용자 결정), 건강점수는 **배지로 병기**. 재료 배선: `ranking` 라우트에 `reelsSharePct`·`avgReach` 추가, `CompareSummary`에 `reelsSharePct` 추가(`summarizeForCompare`). 리더보드 행·정량 비교표(신규 '건강점수' 열)에 `HealthBadge`, 접이식 `HealthLegend`(4축·가중·만점 기준·고지).
- **②-1 신뢰도 기반 가중치 분기(사용자 피드백):** 팔로워 기반 참여율은 저장·공유·도달이 빠져 **신뢰도가 낮다**는 판단 → 반응 축 가중치를 **반응 축이 도달기반(`reachBased`)인지로 분기**. **외부 계정(팔로워기반): 반응20·소통30·꾸준함25·확산25**, **내 계정(도달기반): 반응40·소통20·꾸준함20·확산20**. `reachBased` 키잉이라 내 계정도 도달 미수집이면 외부와 같은 보수적 가중치 사용. `HealthLegend` 비중 열을 '외부·내계정' 2열로 표기 + 사유 고지.
- **③ 쉬운 설명(전체):** 공유 상수 `PLAIN_LANGUAGE_RULE`(`personas.ts`) 신설 → 3개 프롬프트(content-analysis·compare·diagnose) 시스템 지시에 주입(오프라인 사장님 독자·전문어 괄호 풀이·항목당 한 문장 실행형·미사여구 금지). UI: 공용 `Glossary`(`components/accounts/glossary.tsx`, 참여율·도달·노출·릴스·캐러셀·건강점수 풀이 접이식) — 비교 리더보드 + 대시보드 푸터(전 탭 공유)에 배치. 비교 헤더 문구도 쉬운 말로.
- **마이그레이션:** 불필요(건강점수는 기존 수집 지표로 계산, 신규 컬럼 없음).
- **검증:** `npm run lint`/`typecheck`/`build`(24 라우트) 통과.
- **날짜:** 2026-06-10
- **후속(사용자 피드백):** ① **댓글 가중**은 핵심 참여율·벤치마크를 건드리지 않기 위해 **'소통' 축 강화**로 처리 — 만점 기준 댓글비중 **3%→2%**(`INTERACTION_FULL`, 같은 댓글에 더 높은 점수, '댓글 유도→도달' 트렌드 반영). 가중치는 유지. ② **수집 필드 확장(콘텐츠 품질 연구 대비, 재수집이 쿼터·레이트에 묶이므로 미리 적재):** Business Discovery(외부+내 계정)에 **`children`(캐러셀 낱장 id·type·url·thumb)** 추가 → `media_posts.raw`. 해시태그에 **`media_url`+`children`** 추가 → `hashtag_results.raw`(thumbnail_url 은 해시태그 엣지 미지원이라 제외). media_url·thumbnail_url·permalink·timestamp 는 이미 수집 중이었음(thumbnail 은 raw 보관·비전 사용). 전용 컬럼 없이 raw 적재라 **마이그레이션 불필요**. `lint`/`typecheck` 통과.

## D-031. 사용자 토큰 간편 발급 = Facebook Login for Business OAuth (Meta측 셋업 완료 · 구현 예정)
- **배경:** 탐색기 수동 발급(11_GUIDE STEP 7)은 일반 사용자(오프라인 사장님)에게 난이도가 높고 함정("설정 수정" 옵트인 누락 → `/me/accounts` 빈 배열)이 많음 → **버튼 클릭→페북 동의→자동 저장**으로 대체 결정.
- **방식 결정:** **Facebook Login for Business**(비즈니스 유형 앱 전용, `config_id` 기반 OAuth 다이얼로그). 신형 **Instagram API with Instagram Login 은 기각** — 페이스북 페이지 없이 발급돼 더 간편하나 **Business Discovery·해시태그 검색 미지원**이라 서비스 핵심(외부 계정 분석)이 불가.
- **Meta 대시보드 셋업(2026-06-10 완료):** ① 제품 "비즈니스용 Facebook 로그인" 추가 ② 로그인 구성 생성(로그인 버전=**Instagram 그래프 API**, **사용자 액세스 토큰**, 권한 5종) → `config_id=1407928874437388` = `.env.local` `META_LOGIN_CONFIG_ID` ③ 설정(Client/Web OAuth ON·Strict ON, 리디렉션 URI `https://analyze-insta.vercel.app/api/meta/oauth/callback`, localhost는 개발모드 자동 허용).
- **잔여(재개 지점 = 11-4):** ① `public_profile` 고급 액세스 — 클릭 전환이나 **개인정보처리방침 URL 등록 선행**(앱 설정→기본에 `/privacy`·`/terms` 등록; 페이지는 D-026 때 배포돼 200 확인) ② 라우트 2개(`/api/meta/oauth/start`·`/callback`, state 쿠키 + code→단기→`exchangeLongLivedToken` 재사용) + `ConnectCard` "Facebook으로 연결" 버튼(수동 입력 폴백 유지) ③ 테스터 등록 ④ Vercel env(`META_APP_ID/SECRET/LOGIN_CONFIG_ID`)+Redeploy. **전체 절차 = `docs/11_GUIDE_META.md` STEP 11.**
- **운영 범위:** 개발 모드(관리자+테스터)로 운영하다가, 일반 공개 시점에 앱 검수(Advanced Access 5종 + 비즈니스 인증) — 기존 방침 유지.
- **날짜:** 2026-06-10 (셋업) / 구현 미착수

## D-032. 모바일 UX 패스 — 헤더 계정 메뉴 + 순기능 최상단 + 잘림·장문 정리
- **배경(사용자 피드백, 모바일 실사용 스크린샷 3장):** ① 홈 계정 목록에서 **계정 ID가 잘려** 인지 불가(이탈 우려) ② 로그인·토큰 연결·사용량 카드가 위를 차지해 **순기능(계정 목록)이 페이지 중간**에 묻힘 ③ 비교 화면은 설명 글이 많아 한눈에 안 들어오고 리더보드 계정명도 잘림. PC는 문제 없음 → **앱(React Native) 전환은 기각**(문제는 플랫폼이 아니라 레이아웃·정보 우선순위; 이미 PWA로 앱형 설치 가능). 사용자 제안(설정을 상단 고정 바 버튼으로 + 누르면 확장) 채택하되 **버튼 1개 통합·바텀 시트·상태별 분기**로 다듬음.
- **① 헤더 계정 메뉴(`layout/account-menu.tsx` 신설, `AppHeader`에 장착):** 미로그인=헤더 "로그인" 버튼(구글 OAuth 직행). 로그인=프로필 버튼+**상태 점**(초록=개인 토큰 연결/주황=체험·미연결/회색 펄스=확인 중). 클릭 → 모바일 **바텀 시트**·PC(sm↑) 우상단 드롭다운 패널(백드롭+blur, Escape·바깥 클릭 닫기, 열림 중 body 스크롤 잠금). 패널 내용 = 로그인 정보(이메일·상태 배지·로그아웃) + `ConnectCard` + `UsageMeterCard` 재사용.
- **② 토큰 상태 공유 `CredentialsProvider`(`credentials/credentials-provider.tsx` 신설, layout 장착):** `/api/credentials` 조회를 한 곳으로 — 헤더 상태 점·홈 분기·ConnectCard 가 같은 상태를 봄(중복 fetch 제거). `ConnectCard`는 자체 fetch 제거하고 `useCredentials()` 소비, 연결 성공 시 `refresh()`. 미로그인·unconfigured 는 저장값과 무관하게 미연결로 **파생**(effect 동기 setState 회피 — lint `react-hooks/set-state-in-effect`).
- **③ 홈 상태별 분기(`home-section.tsx`):** 미로그인=SignInCard+DemoHome(기존). 로그인+토큰 미연결=온보딩으로 `ConnectCard`만 본문 상단 노출. 로그인+연결됨=설정 카드 전부 헤더 메뉴로 빠지고 **계정 목록이 최상단**. `UsageMeterCard`는 본문에서 제거(헤더 메뉴 전용). `SignInCard`의 로그인됨 분기(이메일+로그아웃)는 헤더 메뉴로 이전·삭제.
- **④ 잘림 해결:** 홈 계정 목록 행 = 모바일 **2줄**(1줄 계정명+팔로워 전체 폭, 2줄 수집/분석/삭제 버튼 `pl-6`) / sm↑ 기존 한 줄(`flex-col sm:flex-row`). 비교 리더보드 계정명 = `truncate` 제거 → `break-all`+`flex-wrap`(자르지 않고 줄바꿈).
- **⑤ 비교 화면 장문 정리:** 헤더 리드 한 문장으로 축약 + 주황 "순서" 박스를 `<details>` 접이식("ⓘ 사용 순서·보이는 데이터 안내")으로. 리더보드 하단 ※ 3개(벤치마크·등급·건강점수)도 `<details>` 접이식으로(기존 `GradeLegend`/`HealthLegend`/`Glossary` 접이식 패턴과 통일). 첫 화면에 리더보드가 바로 보임.
- **마이그레이션:** 불필요(순수 프론트 레이아웃·상태 공유).
- **검증:** `npm run lint`/`typecheck`/`build`(24 라우트) 통과.
- **날짜:** 2026-06-10
---
## 미해결/추후 결정
- [ ] 로그인 프로바이더 최종 확정(구글 단독 vs 구글+카카오) — 현재 구글 우선 가정.
- [ ] 서드파티 공급사 선정(Phase 4 시점).
- [ ] 일반 공개 vs 테스터 한정 운영(앱 검수 진행 여부).
