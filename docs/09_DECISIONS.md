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

---
## 미해결/추후 결정
- [ ] 로그인 프로바이더 최종 확정(구글 단독 vs 구글+카카오) — 현재 구글 우선 가정.
- [ ] 서드파티 공급사 선정(Phase 4 시점).
- [ ] 일반 공개 vs 테스터 한정 운영(앱 검수 진행 여부).
