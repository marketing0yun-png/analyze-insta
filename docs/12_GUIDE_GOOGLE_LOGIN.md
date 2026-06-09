# 12. 가이드 — 구글 로그인(익명 → 구글 link identity)

> Phase 3 배포 잔여. **코드는 스캐폴딩 완료(D-025)** — 아래 외부 설정만 하면 활성화된다.
> 익명으로 모은 데이터를 보존한 채 구글 신원을 연결한다(link identity).

## 현재 상태 (코드)
- `AuthProvider`(`src/components/auth/auth-provider.tsx`)가 `linkGoogle()`·`isAnonymous`를 노출.
- `GoogleLinkCard`(`src/components/auth/google-link.tsx`)가 **익명 세션일 때만** 홈에 "구글로 연결" 버튼을 띄움.
- 버튼은 `supabase.auth.linkIdentity({ provider: 'google' })`를 호출 → OAuth 리다이렉트.
- ⚠️ **Supabase에 Google OAuth가 설정돼 있지 않으면** 버튼 클릭 시 에러 메시지를 그대로 표시한다(스캐폴딩 단계).

## 활성화 절차 (운영자 작업)

### 1) Google Cloud — OAuth 클라이언트 생성
1. https://console.cloud.google.com → APIs & Services → **OAuth consent screen**
   - User type: External, 앱 이름·지원 이메일 입력. 스코프는 기본(email·profile·openid)만 → **검수 없이 게시 가능**(테스트 모드는 테스터 ~100명).
2. **Credentials → Create Credentials → OAuth client ID → Web application**
   - **Authorized redirect URI** 에 Supabase 콜백 추가:
     `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
     (현재 프로젝트: `https://nushcvgafwqosnkzlsrm.supabase.co/auth/v1/callback`)
   - 생성 후 **Client ID / Client Secret** 복사.

### 2) Supabase — Google provider 활성화
1. Supabase 대시보드 → **Authentication → Providers → Google → Enable**.
2. 위 **Client ID / Client Secret** 붙여넣고 저장.
3. **Authentication → URL Configuration → Redirect URLs** 에 앱 도메인 추가
   (로컬: `http://localhost:3000`, 배포: Vercel 도메인). `linkGoogle()`는 `window.location.origin`으로 돌아온다.

### 3) (선택) 익명 → 구글 연결 충돌 처리
- 동일 구글 계정이 이미 다른 사용자에 연결돼 있으면 `linkIdentity`가 에러를 낸다(이메일 중복). 이 경우 일반 로그인(`signInWithOAuth`)으로 전환하는 분기를 추가할 수 있다(현재 스캐폴딩은 link만).

## 검증 체크리스트
- [ ] 익명 세션에서 홈에 "구글 계정 연결" 카드가 보인다.
- [ ] "구글로 연결" → 구글 동의 → 앱으로 복귀 후 `is_anonymous=false`.
- [ ] 연결 전 등록한 계정/수집 데이터가 그대로 남아 있다(데이터 보존).
- [ ] 다른 기기에서 같은 구글로 로그인 시 동일 데이터.

## 참고
- 결정 근거: `docs/06_AUTH_SECURITY.md §1`(구글 우선), `docs/09_DECISIONS.md D-007/D-025`.
- 카카오는 후속 옵션(기본 항목만 쓰면 검수 우회 가능).
