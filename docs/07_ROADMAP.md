# 07. 로드맵 & 진행 상태

> 개발 재개 시 **여기 "다음 할 일"부터** 본다. 작업 완료마다 체크박스/상태 갱신.

## 현재 상태
🟢 **Phase 2 콘텐츠 분석 + Phase 2.5 매장 비교 분석 구현 완료(로컬, build/lint 통과 2026-06-08) — 사용자 검수 대기.**
- 캡션 → AI 분석(`/api/accounts/analyze`, Gemini/Vertex 청크 배치) → `content_analysis` 적재 → 대시보드 "콘텐츠 인사이트" 탭(소구점/톤/포맷/키워드/게시물별).
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
- [x] **Supabase 익명 로그인 토글 ON** (2026-06-07 검증 — 익명 세션 발급 성공)
- [x] `SUPABASE_SERVICE_ROLE_KEY` 를 `.env.local` 에 입력 (검증 — RLS 우회 접근 성공)
- [ ] Vercel 저장소 연결 + 환경변수 등록
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
- [ ] 이미지 비전 분석(멀티모달 provider) — 캡션 외 미디어까지 확장
- **완료 기준:** "어떤 내용/소구점의 콘텐츠가 반응이 좋은가"가 보인다. → **구현 완료(캡션 기반), 사용자 검수 대기.**
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

## Phase 3 — 위임 계정 완전분석 + 비교 + 배포 준비
- [ ] 위임(owned) 계정 Insights 수집(노출·도달·저장 등)
- [ ] 위임 vs 외부 **비교 리포트에 노출·도달 차원 추가** (공개지표 비교는 Phase 2.5에서 완료 · D-021)
- [ ] 마스터 콘솔(전체 데이터 조합 뷰)
- [ ] **익명 → 구글 로그인 교체/연결**(link identity)
- [ ] Meta 앱 검수(일반 공개 시) / 또는 테스터 한정 운영 결정
- [ ] 배포 전 보안 체크(`docs/06_AUTH_SECURITY.md` §5)
- **완료 기준:** MVP 배포 가능. 광고주 본인 계정은 노출까지, 경쟁사는 공개지표로 비교.

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
> Phase 1 + Phase 2(콘텐츠 분석) + Phase 2.5(매장 비교) 구현 완료. **사용자 검수 단계.**
> 1. **Phase 2 검수(`npm run dev`):**
>    - 토큰 연결 + 계정 수집 후 → `/accounts/[id]` → "콘텐츠 인사이트" 탭 → "AI 분석 실행".
>    - 소구점 빈도·톤/포맷·키워드·게시물별(주제·요약·소구점) 카드 확인. "전체 재분석" 동작 확인.
>    - ⚠️ Vertex 자격증명 필요(`GOOGLE_APPLICATION_CREDENTIALS` 또는 인라인 JSON). `/api/ai/ping` 으로 연결 선검증.
> 2. **Phase 2.5 검수:** 홈 "비교 분석" → `/compare` → 참여율 리더보드 확인 → 매장 2~5개 선택 → "비교 분석" → 정량표 + 냉정 평가(강점/약점/개선책). (각 매장 콘텐츠 분석이 선행돼야 의미 있음)
> 3. **Phase 1 검수(잔여):** 분석 대상 "분석" → 참여율·시간대(KST)·요일·포맷·상위 게시물. 해시태그 검색(쿼터 N/30, 소비 주의).
> 4. **검수 피드백 반영** → 분석/비교 프롬프트·스키마 조정.
> 5. **(다음)** 이미지 비전(멀티모달 provider) 또는 Phase 3(위임 계정 노출·도달 + 비교 보강) 착수 판단.
> 6. **(추후/비차단)** 배치 수집/분석 Edge Function 분리(D-015), Meta 앱 시크릿 입력(장기토큰 교환).
> - 로컬 실행: `npm install` → `npm run dev` → http://localhost:3000
