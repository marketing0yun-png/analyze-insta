# 07. 로드맵 & 진행 상태

> 개발 재개 시 **여기 "다음 할 일"부터** 본다. 작업 완료마다 체크박스/상태 갱신.

## 현재 상태
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
- [ ] 캡션 + 미디어 → AI 분석 파이프라인(프로바이더 추상화 위에서 구현)
- [ ] `content_analysis` 저장(주제·소구점·포맷·카피톤) — **모델 중립 JSON 스키마**
- [ ] 대시보드에 콘텐츠 인사이트 탭
- [ ] (정식) Claude provider 추가 또는 사용자별 모델 선택
- **완료 기준:** "어떤 내용/소구점의 콘텐츠가 반응이 좋은가"가 보인다.
- **모델 전략:** 베타까지 Gemini(Vertex 무료 크레딧)로 운영 → 정식 때 Claude 전환 or 사용자 선택(D-019).

## Phase 3 — 위임 계정 완전분석 + 비교 + 배포 준비
- [ ] 위임(owned) 계정 Insights 수집(노출·도달·저장 등)
- [ ] 위임 vs 외부 공개지표 **비교 리포트**
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
> Phase 1 전 기능 구현 완료. **사용자 검수 단계.**
> 1. **검수(`npm run dev`):**
>    - 대시보드: 분석 대상 행의 "분석"(수집 후 노출) → `/accounts/[id]` 에서 참여율·시간대(KST)·요일·포맷 파이·상위 게시물 확인.
>    - 해시태그: "해시태그 검색" 카드에서 키워드 검색 → 인기 게시물·쿼터 카운터(N/30) 동작 확인. (쿼터 소비 주의)
> 2. **검수 피드백 반영** → 지표 정의/표현 조정.
> 3. **(다음 Phase) Phase 2 AI 콘텐츠 분석** 착수 여부 결정 — 적재된 캡션/미디어 → Claude API 주제·소구점·카피톤.
> 4. **(추후/비차단)** 배치 수집 Edge Function 분리(D-015), Meta 앱 시크릿 입력(장기토큰 교환).
> - 로컬 실행: `npm install` → `npm run dev` → http://localhost:3000
