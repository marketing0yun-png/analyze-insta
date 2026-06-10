# 07. 로드맵 & 진행 상태

> 개발 재개 시 **여기 "다음 할 일"부터** 본다. 작업 완료마다 체크박스/상태 갱신.

## 현재 상태
🟢 **배포(Vercel `analyze-insta.vercel.app`) + 익명 폐기→구글 로그인 게이트 + 데모(목업) 모드 구현·푸시 완료(2026-06-09, D-026, 커밋 `7b17d32`). Supabase Google OAuth 설정 완료 → 실서비스 로그인 동작 검증 단계.**
- **3단계:** 데모(비로그인, 목업만) → 체험계정(로그인+오너 토큰, 2h 한도) → 개인 토큰(무제한+노출·도달). 비로그인 홈=`DemoHome` 미리보기 + `/accounts/demo` 예시 대시보드. `ConnectCard`에 체험계정(관리자 토큰·횟수 제한) 안내.
- **운영자 설정 완료(2026-06-09):** Google Cloud OAuth 클라이언트(웹) 생성 + 리디렉션 URI = Supabase 콜백. Supabase Authentication→Providers→Google **활성화 + Client ID/Secret 저장**. URL Configuration Redirect URLs 는 와일드카드(`https://analyze-insta.vercel.app/**`, `http://localhost:3000/**`)로 `/auth/callback` 커버.
- **남은 확인(차단 가능):** ① 구글 **대상→테스트 사용자 추가 또는 앱 게시**(안 하면 "액세스 차단됨"). ② Vercel 환경변수(`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, AI/오너 토큰 등) 등록 확인. ③ 실서비스에서 구글 로그인 왕복 + 토큰 연결까지 1회 검증.

🟢 **Phase 3.5 + Phase 3 배포 잔여(마스터·구글로그인 스캐폴딩) 구현 완료(로컬, build/lint 통과 2026-06-09, D-025) — 사용자 검수 대기.**
- **오너 토큰 폴백(선결 과제 해소):** `META_OWNER_TOKEN` env → `/collect`가 체험 유저 외부 수집을 오너 토큰으로 대행 → **체험 collect 한도(2h 5회) 실제 발동**. 내 계정 노출·도달은 개인 토큰 전용(체험 차단·안내).
- **잔여 게이트 완성:** 외부 계정 개수(체험 3/개인 10) · 해시태그 체험=신청/개인=검색 · 안내 UI(LLM 비용·혼잡·비교용 1회 남기기).
- **해시태그 신청/큐레이션:** `analyze_insta_hashtag_requests`/`_curated_hashtags`(공용 프로젝트 적용) — 체험 신청 → 마스터 처리 → 공통 노출.
- **마스터 콘솔:** `/master` + `GET/POST /api/master`(`isMaster` = `MASTER_EMAILS`/`MASTER_USER_IDS` 화이트리스트, service-role 조합 뷰).
- **구글 로그인:** 코드 스캐폴딩 완료(`linkGoogle`/`GoogleLinkCard`) — Supabase Google OAuth 설정만 남음(`docs/12_GUIDE_GOOGLE_LOGIN.md`).

🟢 **Phase 3.5(미터 코어) 사용량 미터 구현 완료(로컬, build/lint 통과 2026-06-09, D-024).**
- `usage_events` 테이블(공용 프로젝트 적용) + `lib/server/usage-meter.ts`(2시간 슬라이딩 윈도우, 티어=본인 credential 유무) + 게이트(`/collect`·`/analyze`·`/compare`) + `/api/usage` + 홈 `UsageMeterCard`(실시간 카운트다운).
- **2미터:** 수집·지표(체험 5/2h·개인 무제한, `/metrics`는 무계측) / 분석·비교(두 티어 5/2h 공용·LLM 비용이라 안 풀림). 분석은 첫 청크만 1회 과금.

🟢 **Phase 3(핵심) 내 계정 완전분석 구현 완료(로컬, build/lint 통과 2026-06-08, D-023) — 사용자 검수 대기.**
- **내 계정**(토큰 주인 본인, 토큰당 1개): "내 계정 분석 추가" → 수집 시 **노출·도달·저장·조회** 인사이트까지(`fetchOwnedProfile`+`fetchMediaInsights`, per-media 0.25s). 외부 계정은 기존 공개지표만(라벨 "외부 계정").
- **일괄 수집·분석:** 목록 체크박스 + 전체선택 + "선택 수집 & 분석"(계정 사이 0.5s). **일일 캐시**(KST 0시 — 오늘 이미 수집했으면 Meta 호출 생략) + **강제 갱신**(새 게시물 즉시 반영).
- **비교/대시보드:** 내 계정엔 노출·도달 카드·열 추가, 외부는 추정 금지. **마이그레이션 0**(컬럼·enum 기존 존재).
- **후속(미구현):** 마스터 콘솔, 익명→구글 로그인, Meta 앱 검수(휴대폰 인증 보류), 배포 전 보안 체크.

🟢 **Phase 2 콘텐츠 분석(+이미지 비전) + Phase 2.5 매장 비교 분석 구현 완료(로컬, build/lint 통과 2026-06-08) — 사용자 검수 대기.**
- 캡션 **+ 이미지(비전, D-022)** → AI 분석(`/api/accounts/analyze`, Gemini/Vertex 청크 배치) → `content_analysis`(+`visual_notes`) 적재 → 대시보드 "콘텐츠 인사이트" 탭(소구점/톤/포맷/키워드/게시물별+비주얼 노트).
- **비교(2.5):** 참여율 자동순위 리더보드(`/api/accounts/ranking`) + 2~5개 선택 → 정량표 + LLM 냉정 평가(`/api/accounts/compare`, `/compare` 화면). 노출·도달은 비교 제외(공개지표 한정, D-021).
- 증분 분석 기본(미분석만), "전체 재분석" 지원. 이미지 비전은 후속(멀티모달 provider) 과제.
- **검수 포인트:** ① 토큰 연결 + 계정 수집 후 → `/accounts/[id]` "콘텐츠 인사이트" 탭 → "AI 분석 실행" → 소구점/톤/키워드·게시물별. ② 홈 "비교 분석"(2개+ 계정) → `/compare` → 매장 선택 → 냉정 평가. (Vertex 자격증명 필요)

🟢 **Phase 1 기능 구현 완료(로컬) — 사용자 검수 대기. 토큰·수집·대시보드·해시태그까지 실동작 검증(2026-06-08).**
- 공용 Supabase(`nushcvgafwqosnkzlsrm`, "marketing0yun's Project")에 `analyze_insta_*` 11테이블+RLS 이미 적용 확인.
- `.env.local` 작성: Supabase URL/anon키 + `TOKEN_ENCRYPTION_KEY` + `SUPABASE_SERVICE_ROLE_KEY`.
- **토큰 연결·수집 실동작 검증됨** — 실제 토큰으로 `ig_user_id` 추출·저장, 외부 비즈니스 계정 4개 Business Discovery 수집 성공(각 최근 25개).
  - 함정 해결: 크리에이터→비즈니스 무관(둘 다 가능). `#10`은 토큰 스코프(`instagram_manage_insights`) 누락이 원인이었음(재발급으로 해결).
- **Phase 1 전 기능 구현(로컬, `npm run build`/lint 통과):**
  - 등록/수집: `/api/accounts`(CRUD), `fetchBusinessDiscovery`+`collectTrackedAccount`+`/api/accounts/collect` → snapshots/media_posts/post_metrics(외부=노출·도달 null).
  - 지표/대시보드: `lib/analytics/account-metrics.ts`(참여율·업로드 빈도·시간대/요일 KST·포맷 비중·상위 게시물), `/api/accounts/metrics`, `/accounts/[id]`(Recharts).
  - 해시태그: `lib/meta/hashtag.ts`(7일 롤링 30개 쿼터 enforce), `/api/hashtags`, `HashtagCard`(쿼터 카운터).
- **남은 블로커(비차단):** Meta 앱 `META_APP_ID/SECRET` ⏳(보류) — 없어도 동작. appsecret_proof·장기토큰 교환만 비활성.
- **다음:** 사용자 검수 → 피드백 반영 → Phase 2(AI 콘텐츠 분석) 착수 판단.

---

## Phase 0 — 스캐폴딩
**코드(로컬) — 완료:**
- [x] Next.js 16(App Router) + TS + Tailwind v4 + shadcn/ui + Recharts 초기화
- [x] PWA 설정(`app/manifest.ts` + `public/sw.js` + 등록 컴포넌트)
- [x] Supabase 클라이언트(브라우저/서버/admin) + proxy 세션 갱신 + 익명인증 부트스트랩(`AuthProvider`)
- [x] 기본 스키마 마이그레이션 작성(`supabase/migrations/20260605000001_init.sql`, 11테이블 + RLS)
- [x] env 검증 헬퍼 + `.env.example`, git init + 초기 커밋

**외부 리소스 — 사용자/오너 작업 필요(코드만으론 불가):**
- [x] Supabase 프로젝트(공용 `nushcvgafwqosnkzlsrm` 재사용) → URL/anon키 `.env.local` 입력 완료
- [x] 마이그레이션 적용(공용 프로젝트에 `analyze_insta_*` 테이블 존재 확인됨)
- [x] ~~Supabase 익명 로그인 토글 ON~~ → **D-026 에서 익명 폐기, 구글 로그인으로 교체.** Supabase Google provider 활성화 완료(2026-06-09).
- [x] `SUPABASE_SERVICE_ROLE_KEY` 를 `.env.local` 에 입력 (검증 — RLS 우회 접근 성공)
- [x] **Vercel 저장소 연결 + 배포**(`analyze-insta.vercel.app`, main 자동 배포). ⚠️ 환경변수 등록 여부는 최종 확인 필요(현재 상태 "남은 확인" 참조).
- [x] **Google Cloud OAuth 클라이언트(웹) 생성 + Supabase Google provider 설정**(2026-06-09, D-026).
- [ ] Meta 개발자 앱 생성 → `META_APP_ID/SECRET` ⏳ **보류**(휴대폰 인증 이슈, 재개 예정)

## Phase 1 — 외부계정 공개지표 대시보드 ⭐ MVP 핵심
- [x] 토큰 입력/검증 UI → `ig_user_id` 추출·암호화 저장 — **실동작 검증(2026-06-08)**
      (`/api/credentials` POST/GET, `lib/meta/client.ts`, `lib/crypto/token.ts`, `components/credentials/connect-card.tsx`)
- [x] 분석 대상(외부 username) + 카테고리 등록 UI
      (`/api/accounts` GET/POST/DELETE, `components/accounts/accounts-card.tsx`)
- [x] Business Discovery 수집기 + rate limit 모니터링 — **온디맨드(Next route) 우선 구현.**
      (`fetchBusinessDiscovery`, `collectTrackedAccount`, `/api/accounts/collect`) · 배치/cron 은 Edge Function 으로 추후 분리(D-015)
- [x] 지표 계산: 업로드 주기/시간대/빈도, 참여율, 포맷 비중
      (`lib/analytics/account-metrics.ts` 순수함수 — KST 기준 시간대/요일, `/api/accounts/metrics`)
- [x] 계정 분석 대시보드(모바일 우선: 카드·차트)
      (`/accounts/[id]`, `components/accounts/account-dashboard.tsx` — Recharts 파이/바 + 상위 게시물)
- [x] 해시태그 검색(보조) + 7일/30개 쿼터 카운터 UI
      (`lib/meta/hashtag.ts` 롤링 쿼터 enforce, `/api/hashtags`, `components/hashtags/hashtag-card.tsx`)
- **완료 기준:** 외부 경쟁/인플루언서 계정 N개의 공개지표·루틴을 모바일에서 본다. → **구현 완료, 사용자 검수 대기.**

## Phase 2 — AI 콘텐츠 분석
- [x] AI 프로바이더 추상화(`lib/ai/`) + **Gemini 2.5 Flash(Vertex AI)** 1차 구현 — 연결 검증(`/api/ai/ping`, 2026-06-08). 모델 교체/사용자 선택 대비(D-019).
- [x] 캡션 → AI 분석 파이프라인(프로바이더 추상화 위에서 구현) — **구현 완료(로컬, build/lint 통과 2026-06-08).**
      (`lib/ai/content-analysis.ts` 청크 10개 배치·json 모드, `lib/ai/analyze-account.ts` 증분/재분석 오케스트레이터, `POST /api/accounts/analyze`)
      ⚠️ 이미지 **비전** 분석은 provider 인터페이스(텍스트 전용) 확장 필요 → 후속(멀티모달) 과제.
- [x] `content_analysis` 저장(주제·소구점·포맷·카피톤·요약·키워드) — **모델 중립 JSON 스키마**(`ContentAnalysis` 타입). 멱등 적재(대상 기존행 삭제 후 삽입).
- [x] 대시보드에 콘텐츠 인사이트 탭
      (`/accounts/[id]` 지표/인사이트 탭 전환, `components/accounts/content-insights.tsx` — 소구점 빈도·톤/포맷·키워드·게시물별 분석, `lib/analytics/content-insights.ts` 집계, `GET /api/accounts/insights`)
- [ ] (정식) Claude provider 추가 또는 사용자별 모델 선택
- [x] 이미지 비전 분석(멀티모달 provider) — 캡션 외 미디어까지 확장 (**구현 완료(로컬, build/lint 통과 2026-06-08), D-022**)
      프로바이더 인터페이스 멀티모달화(`images`/`supportsVision`) + 인라인 base64(`lib/ai/fetch-image.ts`) + `content_analysis.visual_notes`(시각 요소) + UI 게시물별 비주얼 노트. image/carousel=media_url, video/reel=thumbnail. `AI_VISION` 킬스위치(기본 ON).
- **완료 기준:** "어떤 내용/소구점·**비주얼**의 콘텐츠가 반응이 좋은가"가 보인다. → **구현 완료(캡션+이미지), 사용자 검수 대기.**
- **모델 전략:** 베타까지 Gemini(Vertex 무료 크레딧)로 운영 → 정식 때 Claude 전환 or 사용자 선택(D-019).

## Phase 2.5 — 매장 비교 분석 (공개지표 기반, Phase 3에서 앞당김 · D-021)
- [x] 참여율 자동순위 리더보드 (`GET /api/accounts/ranking`, 공용 로더 `lib/server/account-report.ts`)
- [x] 2~5개 매장 선택 → 정량 비교표 + **LLM 냉정 평가**(강점·약점·개선책 + 매장별 콘텐츠 아이디어 + 전반 기회·다음 액션)
      (`lib/ai/compare-accounts.ts` 모델중립 `ComparisonReport`, `POST /api/accounts/compare`, `reports(kind='comparison')` 적재)
- [x] **벤치마크(목표) 매장 사용자 지정** — 비교마다 ⭐로 따라잡을 대상을 고르면, 나머지 매장이 그 수준에 도달할 방법 중심으로 평가(미지정 시 자동 순위 폴백). per-comparison `benchmarkIds`.
- [x] **참여율 등급(규모 보정)** — 팔로워 규모별 기대치 대비 활발/양호/평균/다소 낮음 + 색상 배지·미터(`lib/analytics/engagement-benchmark.ts`, `components/accounts/engagement-badge.tsx`). 대시보드·리더보드·비교표 공통.
- [x] 전용 화면 `/compare`(`components/accounts/compare-view.tsx`) + 홈 "비교 분석" 진입
- **완료 기준:** "잘나가는 vs 우리 / 잘 vs 못 / 못 vs 우리"를 골라 왜 차이 나는지 본다. → **구현 완료(로컬, build/lint 통과 2026-06-08), 사용자 검수 대기.**
- **한계:** 노출·도달은 비교 불가(외부=공개지표 한정). 노출·도달 포함 완전 비교는 Phase 3(위임 계정).

## Phase 3 — 내 계정 완전분석 + 비교 + 배포 준비
> 용어: UI는 **"내 계정"(노출·도달까지) / "외부 계정"(공개지표만)** 으로 통일(DB 값 owned/delegated 유지, D-023).
- [x] **내 계정 Insights 수집(노출·도달·저장·조회)** — **구현 완료(로컬, build/lint 통과 2026-06-08, D-023)**
      (`fetchOwnedProfile`+`fetchMediaInsights`(종류별 지표셋·폴백), `collectOwnedAccount` per-media 0.25s 페이싱 →
      post_metrics reach/impressions/saved/video_views/plays 적재. 내 계정 등록 `POST /api/accounts/self`(owned+delegated,
      cred.ig_user_id 일치 보장). 수집 라우트 access_tier 분기. **마이그레이션 0** — 컬럼·enum 기존 존재.)
- [x] **내 계정 일괄 수집·분석 + 일일 캐시 + 강제 갱신** — **구현 완료(D-023)**
      (목록 체크박스+전체선택+"선택 수집 & 분석"(클라 orchestrate, 계정 사이 0.5s, 60초/요청 한도 회피),
      `/collect` 일일 캐시 게이트(KST 0시, `{cached:true}`) + `force` 강제.)
- [x] 내 계정 vs 외부 **비교/대시보드에 노출·도달 차원 추가** (공개지표 비교는 Phase 2.5에서 완료 · D-021/D-023)
      (account-metrics avgReach/avgImpressions/avgSaved/avgVideoViews, 대시보드 "내 계정 인사이트" 카드,
      비교 정량표 도달 열(내 계정만) + 프롬프트 "외부는 추정 금지".)
- [x] 마스터 콘솔(전체 데이터 조합 뷰) — **구현 완료(D-025)** (`/master` + `GET/POST /api/master`, `isMaster` env 화이트리스트)
- [x] **익명 폐기 → 구글 로그인 게이트 + 데모(목업) 모드** — **구현·배포·OAuth 설정 완료(D-026, 2026-06-09)**. 비로그인=데모 목업만, 실이용=구글 로그인 후. `signInWithGoogle`/`signOut`/`/auth/callback`(PKCE 교환) + `DemoHome`/`/accounts/demo` + `ConnectCard` 체험계정 안내. Supabase Google provider·Redirect URL 설정 완료(`docs/12_GUIDE_GOOGLE_LOGIN.md`). **잔여:** 실서비스 로그인 왕복 검증 + 구글 테스트사용자/앱게시.
- [ ] Meta 앱 검수(일반 공개 시) / 또는 테스터 한정 운영 결정 — **외부 차단**(휴대폰 인증 보류)
- [~] 배포 전 보안 체크(`docs/06_AUTH_SECURITY.md` §5) — 토큰암호화·시크릿분리·마스터격리 확인, 구글로그인·Meta검수만 잔여
- **완료 기준:** MVP 배포 가능. 광고주 본인 계정은 노출까지, 경쟁사는 공개지표로 비교. → **데이터/비교 핵심 구현 완료, 사용자 검수 대기. 배포 잔여(마스터·구글로그인·검수)는 후속.**

## Phase 3.5 — 프리미엄 티어 + 사용량 미터 (운영 레이어 · D-024)
> 기능이 아니라 **"누가 얼마나 쓰나"를 통제하는 가로 레이어**. 베타 무료 운영 + 개인 토큰 발급 유도.
> 티어 판별 = **개인(Meta) 토큰 등록 여부**. 자세한 결정·근거는 D-024.

**미터는 딱 2종류 (둘 다 "최근 2시간 N회" 슬라이딩 윈도우, 누적 없음):**
> ① **수집·지표 미터**(Meta·무료/시간할당량) — 실질 게이트는 **`/collect` 한 곳**. 지표(`/metrics`)는 Meta·LLM을 안 쓰고 적재된 raw 계산만 하므로 **조회는 공짜·무계측**, 새 데이터가 필요할 때 수집할 때만 미터 소비. 차등의 본질 = "얼마나 자주 재수집(최신화)하느냐". ② **분석·비교 미터**(LLM·비용) — 콘텐츠 인사이트 분석과 비교분석이 한 풀을 공유.

| 항목 | 체험(오너 토큰) | 개인 토큰 |
|---|---|---|
| 외부 계정 | 3개 | 10개 |
| **수집·지표**(Meta·무료) — *오너 쿼터 보호/시간할당량* | 2시간 5회 | **무제한** |
| **분석·비교**(LLM·비용) — *AI 비용 방어* | 2시간 5회 공용 | 2시간 5회 공용 |
| 내 계정 노출·도달 | ❌ "개인 토큰 입력 필요" 안내 | ✅ |
| 해시태그 | 신청만 | 직접 검색(본인 쿼터) |
| 해시태그 노출 | 마스터 공통 큐레이션 | + 본인 검색 개인화 |

> **핵심:** 수집·지표 = 무료지만 체험은 시간할당량 / 개인 토큰은 무제한. 분석·비교 = LLM 비용이라 **두 티어 모두** 제한(개인 토큰이어도 비용은 운영자 부담이라 안 풀림). 추후 유료화 대상도 이 분석·비교뿐.

- [x] 사용 이력 테이블 + 2시간 윈도우 카운트 — **구현 완료(로컬, build/lint 통과 2026-06-09)**
      (`analyze_insta_usage_events` + enum `analyze_insta_usage_action('collect','llm')`, `migrations/20260609000001_usage_meter.sql`, **공용 프로젝트 적용 완료**.
      유틸 `lib/server/usage-meter.ts`: `resolveTier`(본인 credential 유무) / `getMeterStatus`(슬라이딩 윈도우·resetAt) / `recordUsage`(append) / `getAllMeters` / `meterBlockedMessage`.)
- [x] 미터 게이트 — **구현 완료**
      (`/collect`: 캐시 히트 제외·실수집 성공 시 collect 1칸. `/analyze`: 첫 청크만 LLM 미터 확인·실분석 시 1칸(연속 청크 무과금, 클라 `first` 플래그). `/compare`: 비교 성공 시 LLM 1칸. + `GET /api/usage` 상태 엔드포인트.)
- [x] **잔여 게이트**: 외부 계정 개수 한도(체험 3 / 개인 10), `/hashtags` 개인 토큰 전용(체험=신청), 내 계정 노출·도달 개인 토큰 전용. — **구현 완료(D-025)**
- [x] **선결 과제 — 오너 토큰 폴백:** `META_OWNER_TOKEN` env 주입 → `/collect`가 본인 credential 우선, 없으면(체험) 오너 토큰으로 외부 공개지표 수집 대행. 이로써 체험 collect 한도(2시간 5회)가 실제로 발동. 내 계정(노출·도달)은 오너 토큰으로 불가 → 개인 토큰 안내. — **구현 완료(D-025)**
- [x] 카운트다운 UI — **구현 완료**
      (`components/usage/usage-meter-card.tsx`: 티어 배지 + 수집·지표/분석·비교 잔여 `n/limit`·무제한 + 막힘 시 "다음 가능 10:34 · 1시간 12분 후" 실시간 카운트다운. 홈 배치, 30초 폴링 + 포커스 + 액션 직후 `usage:refresh` 이벤트 즉시 갱신.)
- [x] 잔여 안내 UI: 기능별 비활성("개인 토큰 입력 필요" — 내 계정 노출·도달), 일괄 분석 시 "비교분석용 1회는 남겨두세요" 안내(분석·비교 한 풀 공용, 잔여 ≤1 시) — **구현 완료(D-025)**
- [x] 해시태그 **신청** 테이블(날짜·키워드·user_id) + 마스터 집계·처리(`/master`) + 큐레이션 공통 노출 — **구현 완료(D-025, `analyze_insta_hashtag_requests`/`_curated_hashtags`)**
- [x] LLM 비용 안내 문구(테스트 무료·관리자 부담·제한 양해·추후 완화·모델 업그레이드 예정) — **구현 완료(UsageMeterCard)**
- [x] 혼잡 안내(수집 느려질 수 있음 → 개인 토큰 연결 유도) — **구현 완료(UsageMeterCard)**
- [ ] 크레딧 충전 수단 검토(행동 보상 / 보상형 광고 — ⚠️ 애드센스 인센티브 클릭 금지) · 쿠팡파트너스(구매 기반·대가성 표시 의무) — **모바일 앱 단계 후속**
- **완료 기준:** 무료 베타를 비용 방어하며 운영, 개인 토큰 발급이 자연스럽게 유도된다.
- **연관:** 페이스북 로그인(OAuth)으로 개인 토큰 자동 발급 → **Meta 앱 검수 후** 공개 단계에 전환(Phase 3 잔여).

## ── MVP 점검 지점 ──
여기서 실사용 후 Phase 4 진행 여부 결정.

## Phase 4 — 서드파티 보강 (선택)
- [ ] 서드파티 공급사 PoC(EnsembleData/Apify 등) — 비용·안정성·약관 평가
- [ ] 외부 계정 **조회수(재생수)·댓글내용** 수집(`source=thirdparty`)
- [ ] 기존 대시보드에 보강 데이터 병합
- **주의:** 노출/도달은 서드파티로도 불가 — 추가하지 않는다.

## 향후 (범위 외, 후속 검토)
- 쓰레드 채널 어댑터(내 계정 위주)
- 페북 채널(내 페이지 한정)
- React Native 네이티브 앱

---

## 다음 할 일 (Next Action)
> **배포 라이브(`analyze-insta.vercel.app`) + 구글 로그인/데모 모드 푸시 완료(D-026).** 이제 **실서비스 동작 검증**이 1순위.
>
> ### 0. ⭐ 실서비스 구글 로그인 E2E 검증 (지금 바로)
>    - 배포 **Ready** 확인(Vercel Deployments, 커밋 `7b17d32`) → `analyze-insta.vercel.app` 강력 새로고침(Ctrl+Shift+R).
>    - **로그아웃 상태:** 데모 배너 + "구글로 시작하기" + 예시 사용량·계정 + `/accounts/demo` 예시 대시보드(노출·도달 포함) 노출 확인.
>    - **로그인:** "구글로 로그인하고 시작" → 구글 동의 → 복귀 후 **헤더 우상단 프로필 버튼**(상태 점) 클릭 → 패널에 이메일·로그아웃·토큰 연결·사용량 표시(D-032).
>      - ⚠️ "액세스 차단됨" 이면 → 구글 **대상→테스트 사용자 추가** 또는 **앱 게시**.
>      - ⚠️ 로그인 후 기능에서 503/오류면 → **Vercel 환경변수** 누락(현재 상태 "남은 확인" 목록 등록).
>    - **체험계정 인지:** 토큰 미연결 상태에서 "인스타 토큰 연결" 카드에 **체험계정(관리자 토큰·횟수 제한) 안내** 노출 확인.
>    - **로그아웃** → 다시 데모 모드 복귀 확인.
>
> ### 1. 기능 검수 (로그인 후, 로컬 `npm run dev` 또는 배포)
>    - **Phase 3(내 계정):** 본인 비즈니스 토큰(`instagram_manage_insights`) 연결 → "내 계정 분석 추가" → 초록 "내 계정" 배지 → "수집" → `/accounts/[id]` "내 계정 인사이트(노출·도달)" 카드 + 상위 게시물 "도달". Supabase `analyze_insta_post_metrics` reach/impressions 확인. 일괄/캐시/강제갱신·비교 도달열.
>    - **Phase 2:** `/accounts/[id]` "콘텐츠 인사이트" → "AI 분석 실행" → 소구점/톤/키워드·게시물별. (Vertex 자격증명 필요 — `/api/ai/ping` 선검증.) 이미지 비전(D-022): 비디오/릴스는 **재수집** 후 재분석해야 thumbnail 채워짐.
>    - **Phase 2.5:** 홈 "비교 분석" → `/compare` → 리더보드 → 2~5개 → 냉정 평가.
>    - **Phase 1:** 참여율·시간대(KST)·요일·포맷·상위 게시물 / 해시태그(쿼터 소비 주의).
>    - **체험 한도:** 오너 토큰(`META_OWNER_TOKEN`)으로 체험 수집 2h 5회 발동 확인 / 미터 카드 카운트다운.
>
> ### 2. ⭐ Meta OAuth 간편 토큰 발급 — 코드 구현 (D-031, 다음 개발 작업)
>    - **Meta측 셋업 완료(2026-06-10):** Facebook Login for Business 구성 `config_id=1407928874437388`(`.env.local` `META_LOGIN_CONFIG_ID` 반영) + 리디렉션 URI 등록. **절차·재개 지점 = `docs/11_GUIDE_META.md` STEP 11 체크리스트.**
>    - 잔여: ① 11-4 `public_profile` 고급 액세스(앱 기본정보에 `/privacy` URL 등록부터) ② 라우트 2개(`/api/meta/oauth/start`·`/callback`) + ConnectCard "Facebook으로 연결" 버튼(수동 입력 폴백 유지) ③ 테스터 등록 ④ Vercel env 3종 + Redeploy.
>
> ### 3. 모바일 UX 패스(D-032) 배포·실기기 확인
>    - 커밋·푸시 후 모바일 실기기에서: 헤더 계정 메뉴(바텀 시트), 계정 목록 2줄(잘림 없음), 토큰 연결 시 계정 목록 최상단, 비교 화면 접이식 안내 확인.
>
> ### 4. 검수 피드백 반영 → 분석/비교 프롬프트·스키마 조정.
>
> ### 5. (추후/비차단)
>    - 배치 수집/분석 Edge Function 분리(D-015).
>    - Meta 앱 검수(Advanced Access 5종 + 비즈니스 인증) — **일반 공개 전환 시에만**(테스터 한정 운영이면 불필요). 앱 시크릿 입력·OAuth 셋업은 완료(D-031).
>    - (정식) Claude provider 추가/모델 선택, 크레딧 충전(Phase 3.5).
>    - 배포 전 보안 체크 마무리(`docs/06_AUTH_SECURITY.md §5`).
>    - ── **MVP 점검** 후 Phase 4(서드파티) 진행 여부 결정.
> - 로컬 실행: `npm install` → `npm run dev` → http://localhost:3000
