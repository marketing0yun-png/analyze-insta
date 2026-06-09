# 06. 인증 & 보안

## 1. 인증 전략

### 단계적 접근 (확정)
1. **익명인증으로 시작** (Supabase Anonymous Sign-in)
   - 로그인 화면 없이 사용자를 백그라운드 식별 → "오픈" 느낌 유지하면서 데이터 격리(RLS).
2. **배포 전 소셜 로그인 교체/추가**
   - 익명 사용자를 실제 계정에 **link identity** → 그동안 쌓인 데이터 보존.
   - **구글 우선**(아래 이유). 필요 시 카카오 추가.

### 왜 구글 우선
| | 구글 | 카카오 |
|---|---|---|
| 즉시 사용 | ✅ 테스트 모드 즉시(테스터 ~100명), 사이트 완성 불필요 | ✅ 기본 항목만 쓰면 가능 |
| 검수 | 기본 스코프(email·profile·openid)면 검수 없이 게시 | 추가 동의항목(이메일 등) 켜면 검수·사이트 요구 |
| Supabase 지원 | 네이티브 | 네이티브 |
- 결론: 구글이 사이트 완성 전 즉시 + 검수 거의 없음 → **구글 단독으로 시작, 카카오는 후속 옵션.**
- 카카오 팁: **닉네임/프로필사진 기본 항목만** 쓰면 검수·사이트완성 관문 우회 가능. 막혔던 건 불필요한 동의항목(이메일 등) 때문일 가능성 높음.

### 역할(Role)
- `user`: 자기 데이터만(RLS).
- `master`: service-role(서버사이드)로 전체 조회·조합. 클라이언트에 service-role key 절대 노출 금지.

## 2. 토큰/시크릿 보안 (필수)
사용자가 **자기 Meta API 토큰을 입력**하는 서비스 → 보안 책임이 처음부터 발생.

- ✅ Meta 토큰은 **Supabase Vault 또는 암호화 컬럼**에 저장. 평문 금지.
- ✅ 토큰 사용(복호화·API 호출)은 **서버사이드(Edge Function/API route)에서만.**
- ✅ 프론트엔드는 Meta 토큰을 **절대 받지도 보지도 않는다.**
- ✅ Supabase **service-role key·Meta 앱 시크릿**은 서버 환경변수 전용. 프론트 번들 금지.
- ✅ 프론트엔 Supabase **anon key**만(+RLS로 보호).
- ✅ 토큰 만료(~60일) 전 갱신 로직.
- ✅ 익명 단계에서도 위 규칙 동일 적용(로그인 유무 무관).

## 3. 환경변수 구분
| 변수 | 위치 | 노출 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 프론트 | 공개 OK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 프론트 | 공개 OK(RLS 전제) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 | **비밀** |
| `META_APP_ID` / `META_APP_SECRET` | 서버 | **비밀** |
| `TOKEN_ENCRYPTION_KEY` (Vault 미사용 시) | 서버 | **비밀** |
| `ANTHROPIC_API_KEY` | 서버 | **비밀** |

## 4. RLS 원칙
- 모든 사용자 데이터 테이블: `user_id = auth.uid()` 정책.
- `api_credentials`: 클라이언트 직접 SELECT 금지 → 서버 함수만 경유.
- 마스터 전체 접근은 RLS 우회(service-role)로만, 서버에서.

## 5. 배포 전 체크
- [x] **구글 로그인 동작**(D-026, 2026-06-09) — 익명 폐기·구글 로그인 게이트. Supabase Google provider 설정 완료. (실서비스 왕복 최종 검증만 잔여)
- [x] 토큰 암호화 저장·복호화 서버 경유 확인 (`lib/crypto/token.ts` AES-256-GCM·`server-only`, 토큰 라우트 `runtime='nodejs'`·복호화 service-role 경유)
- [x] service-role/앱 시크릿이 프론트 번들에 없음 확인 (`lib/env.ts`: `NEXT_PUBLIC_*`만 공개, 서버 getter는 `server-only`에서만; `admin.ts`도 `server-only`)
- [x] 마스터 전체 접근은 service-role + env 화이트리스트(`isMaster`)로만 (`/api/master`, D-025)
- [x] 전 API 라우트 미인증 차단(401) 확인 (D-026 — `getUser()` 없으면 거부; 데모는 클라 목업만, 서버 호출 없음)
- [x] 개인정보처리방침·이용약관 페이지(`/privacy`, `/terms`) 게시 (D-026 — 구글 브랜딩 인증·법적 고지용)
- [ ] Meta 앱 검수(일반 공개 시) 또는 테스터 한정 운영 결정 — **휴대폰 인증 보류로 외부 차단**
- [ ] `META_OWNER_TOKEN`(체험 수집용)은 서버 env에만, 장기 토큰 권장(만료 시 체험 수집 중단)
- [ ] 배포 시 env 등록: `MASTER_EMAILS`·`META_OWNER_TOKEN` + 기존 시크릿 일체 (Vercel/Supabase 시크릿)
