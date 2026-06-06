# 07. 로드맵 & 진행 상태

> 개발 재개 시 **여기 "다음 할 일"부터** 본다. 작업 완료마다 체크박스/상태 갱신.

## 현재 상태
🟡 **Phase 1 착수 — 토큰 입력/검증·암호화 저장 흐름 구현 완료(로컬). 외부 토글 대기.**
- 공용 Supabase(`nushcvgafwqosnkzlsrm`, "marketing0yun's Project")에 `analyze_insta_*` 11테이블+RLS 이미 적용 확인.
- `.env.local` 작성: Supabase URL/anon키 + 생성한 `TOKEN_ENCRYPTION_KEY`. (service-role·Meta 시크릿은 자리표시자)
- 토큰 연결 흐름(POST `/api/credentials`): 토큰 검증→`ig_user_id` 추출→장기토큰 교환(앱 시크릿 시)→AES-256-GCM 암호화 저장. `npm run build`/lint 통과.
- **외부 토글:** ① Supabase 익명 로그인 ON ✅(2026-06-07 검증) ② `SUPABASE_SERVICE_ROLE_KEY` 입력 ✅(검증) ③ Meta 앱 생성→`META_APP_ID/SECRET` ⏳(휴대폰 인증 이슈로 보류).
- 👉 Supabase 인프라(익명인증·토큰 저장)는 준비 완료. **남은 블로커는 Meta 앱/토큰뿐** — 토큰 연결 실제 동작 검증은 Meta 재개 후.

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
- [x] 토큰 입력/검증 UI → `ig_user_id` 추출·암호화 저장
      (`/api/credentials` POST/GET, `lib/meta/client.ts`, `lib/crypto/token.ts`, `components/credentials/connect-card.tsx`)
- [ ] 분석 대상(외부 username) + 카테고리 등록 UI
- [ ] Business Discovery 수집기(Edge Function) + rate limit 모니터링
- [ ] 지표 계산: 업로드 주기/시간대/빈도, 참여율, 해시태그·포맷 비중
- [ ] 계정 분석 대시보드(모바일 우선: 카드·차트)
- [ ] 해시태그 검색(보조) + 7일/30개 쿼터 카운터 UI
- **완료 기준:** 외부 경쟁/인플루언서 계정 N개의 공개지표·루틴을 모바일에서 본다.

## Phase 2 — AI 콘텐츠 분석
- [ ] 캡션 + 미디어 → Claude API 분석 파이프라인
- [ ] `content_analysis` 저장(주제·소구점·포맷·카피톤)
- [ ] 대시보드에 콘텐츠 인사이트 탭
- **완료 기준:** "어떤 내용/소구점의 콘텐츠가 반응이 좋은가"가 보인다.

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
> 토큰 연결 흐름까지 구현 완료. 활성화 + 다음 기능:
> 1. **사용자 토글 3건** (코드 불가):
>    - Supabase 익명 로그인 ON → 루트 "익명 인증" 카드가 `연결됨`이 되는지 확인.
>    - `.env.local` 에 `SUPABASE_SERVICE_ROLE_KEY` 입력 (없으면 토큰저장 503).
>    - Meta 앱 생성 → `META_APP_ID/SECRET` 입력 (없어도 토큰 검증·저장은 동작, 장기토큰 교환·appsecret_proof만 비활성).
> 2. **연결 검증:** 익명 ON 후 실제 Meta 토큰으로 "검증 후 연결" → `ig_user_id` 추출·저장 확인.
> 3. **다음 Phase 1 기능:** 분석 대상(외부 username)+카테고리 등록 UI → Business Discovery 수집기(Edge Function).
> - 로컬 실행: `npm install` → `npm run dev` → http://localhost:3000
