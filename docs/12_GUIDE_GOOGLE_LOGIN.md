# 12. 가이드 — 구글 로그인(익명 폐기 → 구글 로그인 게이트, D-026)

> **코드 구현 완료(D-026)** — 아래 외부 설정만 하면 활성화된다.
> 익명인증은 폐기됐다. 로그인 전엔 데모(목업)만 보이고, 실제 이용은 구글 로그인 후 가능.

## 현재 상태 (코드)
- `AuthProvider`(`src/components/auth/auth-provider.tsx`)가 `signInWithGoogle()`·`signOut()`·`isAuthenticated`를 노출. 익명인증 자동 생성은 제거됨.
- `SignInCard`(`src/components/auth/sign-in-card.tsx`)가 홈에서 로그아웃 시 "구글로 시작하기", 로그인 시 이메일+로그아웃을 표시.
- 버튼은 `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/auth/callback } })`를 호출 → OAuth 리다이렉트.
- `/auth/callback` route(`src/app/auth/callback/route.ts`)가 PKCE code 를 세션으로 교환(`exchangeCodeForSession`)하고 홈으로 리다이렉트.
- ⚠️ **Supabase에 Google OAuth가 설정돼 있지 않으면** 버튼 클릭 시 에러 메시지를 그대로 표시한다.

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
3. **Authentication → URL Configuration → Redirect URLs** 에 콜백 URL 추가
   (로컬: `http://localhost:3000/auth/callback`, 배포: `https://<도메인>/auth/callback`).
   `signInWithGoogle()`는 `window.location.origin + /auth/callback` 으로 돌아온다.

## 검증 체크리스트
- [ ] 로그아웃 상태 홈에 "구글로 시작하기" 카드 + 데모 목업이 보인다.
- [ ] "구글로 로그인하고 시작" → 구글 동의 → `/auth/callback` → 홈 복귀 후 로그인 상태(이메일 표시).
- [ ] 로그인 후 실제 기능 카드(토큰 연결·사용량·계정·해시태그)가 보인다.
- [ ] 로그아웃 → 다시 데모 모드로 복귀.
- [ ] 다른 기기에서 같은 구글로 로그인 시 동일 데이터(RLS 격리·동일 user_id).

## 참고
- 결정 근거: `docs/06_AUTH_SECURITY.md §1`(구글 우선), `docs/09_DECISIONS.md D-007/D-025`.
- 카카오는 후속 옵션(기본 항목만 쓰면 검수 우회 가능).
