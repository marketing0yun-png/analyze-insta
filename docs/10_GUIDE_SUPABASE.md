# 10. Supabase 설정 사용설명서 (상세)

> 이 문서는 **Supabase에서 사람이 직접 해야 하는 작업**을 순서대로 정리한 매뉴얼이다.
> 코드/마이그레이션은 이미 적용돼 있고(공용 프로젝트), 여기서는 **대시보드 토글·키 복사**가 핵심.
> 요약 체크리스트는 `docs/08_SETUP.md`, 결정 배경은 `docs/09_DECISIONS.md`(D-007, D-008, D-011).

---

## 0. 현재 상태 (먼저 읽기)
- 이 프로젝트는 **새 Supabase 프로젝트를 만들지 않는다.** 기존 공용 프로젝트를 공유한다.
  - 프로젝트명: **`marketing0yun's Project`**
  - ref(프로젝트 ID): **`nushcvgafwqosnkzlsrm`**
  - URL: `https://nushcvgafwqosnkzlsrm.supabase.co`
- 우리 앱 테이블 11개(`analyze_insta_*`) + RLS는 **이미 적용 완료**. (다시 마이그레이션할 필요 없음)
- `.env.local` 에 URL/anon키/암호화키는 **이미 입력됨**.
- 👉 **남은 사람 작업은 딱 2가지:** ① 익명 로그인 ON ② service-role 키 입력.

> ⚠️ 공용 프로젝트라 `public` 스키마를 다른 앱(`01marketing_*`, `p02_*`, `key_*` 등)과 공유한다.
> 새 테이블/함수를 추가할 땐 **반드시 `analyze_insta_` 접두사**를 붙인다(충돌 방지).

---

## 1. (필수) 익명 로그인 활성화 — 가장 중요
앱은 로그인 화면 없이 **익명 인증**으로 사용자를 식별하고 RLS로 데이터를 격리한다.
현재 이 토글이 **꺼져 있어** 토큰 연결이 동작하지 않는다(`anonymous_provider_disabled`).

1. [supabase.com/dashboard](https://supabase.com/dashboard) 로그인.
2. 프로젝트 **`marketing0yun's Project`** 선택.
3. 왼쪽 메뉴 **Authentication**(사람 아이콘) 클릭.
4. **Sign In / Providers** 탭(또는 `Providers`) 으로 이동.
5. 목록에서 **Anonymous Sign-ins**(익명 로그인) 항목을 찾는다.
   - 위치가 안 보이면 상단 검색 또는 `Authentication → Settings` 의 *User Signups* 영역 확인.
6. 토글을 **Enabled(ON)** 로 바꾸고 **Save**.

### 확인 방법
- 로컬 앱 실행(`npm run dev`) 후 `http://localhost:3000` 접속.
- 상단 **"익명 인증 / Supabase"** 카드가 회색 `환경변수 미설정`/`오류` 가 아니라
  초록색 **`연결됨`** + `anon user id: ...` 가 보이면 성공.
- 또는 터미널에서 직접 확인:
  ```bash
  curl -s -X POST "https://nushcvgafwqosnkzlsrm.supabase.co/auth/v1/signup" \
    -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
    -H "Content-Type: application/json" -d "{}"
  ```
  - 성공: `access_token` 이 포함된 JSON 반환.
  - 실패: `{"error_code":"anonymous_provider_disabled", ...}` → 아직 토글 OFF.

---

## 2. (필수) service-role 키 입력
서버가 `analyze_insta_api_credentials`(토큰 저장) 테이블에 **RLS 우회**로 접근하려면 service-role 키가 필요하다.
이 키는 보안상 MCP/코드로 자동 조회가 불가 → **사람이 복사**해야 한다.

1. 대시보드 → 프로젝트 → **Project Settings**(왼쪽 하단 톱니).
2. **API Keys**(또는 `API`) 메뉴.
3. **Project API keys** 섹션에서 두 가지를 확인:
   - `anon` `public` → 이미 `.env.local` 에 들어있음(공개 가능).
   - **`service_role` `secret`** → **Reveal** 눌러 값 복사. ⚠️ **절대 외부 노출·커밋 금지.**
4. 프로젝트 루트 `.env.local` 파일을 열어 아래 줄을 채운다:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<복사한 service_role 키>
   ```
5. 개발 서버 재시작(`npm run dev` 재실행) — env는 시작 시 로드된다.

> service-role 키가 없으면 토큰 저장 시도 시 앱이 `503`("서버 시크릿 미설정")로 안내한다.

---

## 3. 키/URL이 어디에 쓰이는지 (참고)
| 값 | 위치(대시보드) | `.env.local` 키 | 노출 |
|---|---|---|---|
| Project URL | Settings → API | `NEXT_PUBLIC_SUPABASE_URL` | 공개 OK |
| `anon` `public` 키 | Settings → API Keys | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 OK(RLS 전제) |
| `service_role` `secret` 키 | Settings → API Keys | `SUPABASE_SERVICE_ROLE_KEY` | **비밀** |

- 프론트(브라우저)에는 **anon 키만** 나간다. service-role/토큰은 100% 서버에서만.

---

## 4. (확인용) 우리 테이블이 잘 있는지 보기
1. 대시보드 → **Table Editor** 또는 **Database → Tables**.
2. `public` 스키마에서 `analyze_insta_` 로 시작하는 테이블 11개 확인:
   `analyze_insta_users`, `analyze_insta_api_credentials`, `analyze_insta_categories`,
   `analyze_insta_tracked_accounts`, `analyze_insta_account_snapshots`, `analyze_insta_media_posts`,
   `analyze_insta_post_metrics`, `analyze_insta_hashtag_jobs`, `analyze_insta_hashtag_results`,
   `analyze_insta_content_analysis`, `analyze_insta_reports`.
3. 각 테이블에 **RLS enabled** 표시가 있는지 확인(있어야 정상).
- 만약 테이블이 없다면(다른 환경) `supabase/migrations/20260605000001_init.sql` 를 SQL Editor에 붙여 실행.

---

## 5. (Phase 3, 나중) 구글 로그인 전환
배포 전 익명 → 구글 로그인으로 교체한다(`docs/06_AUTH_SECURITY.md` §1, D-007). 지금은 안 해도 됨.

1. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 생성.
2. **API 및 서비스 → OAuth 동의 화면** 구성. 스코프는 `email`, `profile`, `openid` 만(이러면 검수 불필요).
3. **사용자 인증 정보 → OAuth 클라이언트 ID** 생성(웹 애플리케이션).
   - 승인된 리디렉션 URI: `https://nushcvgafwqosnkzlsrm.supabase.co/auth/v1/callback`
4. 생성된 **Client ID / Client Secret** 복사.
5. Supabase → Authentication → Providers → **Google** 활성화 후 Client ID/Secret 입력, Save.
6. 코드에서 익명 사용자를 구글 계정으로 **link identity**(데이터 보존). — Phase 3에서 구현.

---

## 6. 트러블슈팅
| 증상 | 원인 | 해결 |
|---|---|---|
| 카드가 `환경변수 미설정` | `.env.local` 의 URL/anon키 비어있음 | §3 값 확인 후 서버 재시작 |
| 카드가 `오류` | 익명 로그인 OFF | §1 토글 ON |
| 토큰 연결 시 `503 서버 시크릿 미설정` | service-role 키 없음 | §2 키 입력 |
| `anonymous_provider_disabled` | 익명 로그인 OFF | §1 토글 ON |
| env 바꿨는데 반영 안 됨 | 개발 서버가 기존 env 캐시 | `npm run dev` 재시작 |
