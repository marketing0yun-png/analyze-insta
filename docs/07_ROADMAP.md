# 07. 로드맵 & 진행 상태

> 개발 재개 시 **여기 "다음 할 일"부터** 본다. 작업 완료마다 체크박스/상태 갱신.

## 현재 상태
🟢 **Phase 0 코드 스캐폴딩 완료(로컬). 외부 리소스 연결 대기.**
로컬에서 `npm run build` 통과, 루트 상태 대시보드 렌더 확인(익명세션 env 미설정 시 graceful).
다음: 외부 리소스(Supabase 프로젝트·Meta 앱·Vercel) 생성 → env 채우면 익명인증 활성.

---

## Phase 0 — 스캐폴딩
**코드(로컬) — 완료:**
- [x] Next.js 16(App Router) + TS + Tailwind v4 + shadcn/ui + Recharts 초기화
- [x] PWA 설정(`app/manifest.ts` + `public/sw.js` + 등록 컴포넌트)
- [x] Supabase 클라이언트(브라우저/서버/admin) + proxy 세션 갱신 + 익명인증 부트스트랩(`AuthProvider`)
- [x] 기본 스키마 마이그레이션 작성(`supabase/migrations/20260605000001_init.sql`, 11테이블 + RLS)
- [x] env 검증 헬퍼 + `.env.example`, git init + 초기 커밋

**외부 리소스 — 사용자/오너 작업 필요(코드만으론 불가):**
- [ ] Supabase 프로젝트 생성 → URL/anon/service-role 키를 `.env.local`에 입력
- [ ] 마이그레이션 적용(`supabase db push` 또는 MCP `apply_migration`) + 익명인증 토글 ON
- [ ] Vercel 저장소 연결 + 환경변수 등록
- [ ] Meta 개발자 앱 생성 + 비즈니스 인증 시작(리드타임 김 — 먼저 착수)

## Phase 1 — 외부계정 공개지표 대시보드 ⭐ MVP 핵심
- [ ] 토큰 입력/검증 UI → `ig_user_id` 추출·암호화 저장
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
> Phase 0 코드 스캐폴딩 완료. 다음 순서:
> 1. **Supabase 프로젝트 생성** → `.env.local` 채우고 마이그레이션 적용, 익명인증 토글 ON.
>    → 루트 페이지 "익명 인증" 카드가 `연결됨`으로 바뀌는지 확인.
> 2. **Meta 앱 생성 + 비즈니스 인증 착수**(리드타임 길어 먼저).
> 3. 확인되면 **Phase 1** 착수: 토큰 입력/검증 UI → `ig_user_id` 추출·암호화 저장.
> - 로컬 실행: `npm install` → `npm run dev` → http://localhost:3000
