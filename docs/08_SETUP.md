# 08. 환경 셋업 절차

> 개발 착수 시 1회성 환경 구성. 완료 항목은 체크.
> 📖 **단계별 상세 매뉴얼:** Supabase → `docs/10_GUIDE_SUPABASE.md`, Meta → `docs/11_GUIDE_META.md`.
> (이 문서는 요약 체크리스트, 위 두 문서가 그림·순서 포함 실사용 설명서)

## 1. Meta 개발자 앱 (리드타임 김 — 가장 먼저)
- [ ] [developers.facebook.com](https://developers.facebook.com) 앱 생성
- [ ] 제품에 **Instagram Graph API** 추가
- [ ] **비즈니스 인증** 시작(일반 공개 배포에 필요, 수일~수주)
- [ ] OAuth Redirect URI 등록(로컬: `http://localhost:3000/...`, 배포: Vercel 도메인 / Supabase callback)
- [ ] 필요한 권한: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`
- [ ] 테스트용 IG **비즈니스/크리에이터 계정** + 연결된 FB 페이지 준비
- 참고: 개발모드는 등록 테스터만 동작. 일반 공개는 앱 검수 필요(`docs/05_META_API.md` §4).

## 2. Supabase
- [ ] 프로젝트 생성(MCP `create_project` 또는 콘솔)
- [ ] **Anonymous sign-in** 활성화 (Auth 설정)
- [ ] (Phase 3) **Google provider** 설정 — Google Cloud Console에서 OAuth client 생성 후 키 입력
- [ ] 스키마 마이그레이션 적용(`docs/04_DATA_MODEL.md`)
- [ ] RLS 정책 적용(`docs/06_AUTH_SECURITY.md` §4)
- [ ] Vault 또는 토큰 암호화 컬럼 준비
- [ ] Edge Function 스캐폴드(수집 잡)

## 3. Google OAuth (Phase 3, 미리 만들어도 OK)
- [ ] [Google Cloud Console](https://console.cloud.google.com) 프로젝트
- [ ] OAuth 동의화면 구성(스코프: email, profile, openid → 검수 불필요)
- [ ] OAuth client ID/secret 생성 → Supabase에 입력
- [ ] 테스트 모드면 즉시 사용(테스터 등록), 게시 시 기본 스코프라 검수 없이 가능

## 4. Vercel
- [ ] 저장소 연결
- [ ] 환경변수 설정(아래)
- [ ] 빌드/배포 확인

## 5. 환경변수 (`.env.local` / Vercel)
```
# 프론트 (공개 가능)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# 서버 전용 (비밀 — 프론트 노출 금지)
SUPABASE_SERVICE_ROLE_KEY=
META_APP_ID=
META_APP_SECRET=
TOKEN_ENCRYPTION_KEY=        # Vault 미사용 시
ANTHROPIC_API_KEY=           # Phase 2
```
- [ ] `.env.example` 작성(값 없이 키만), `.env.local`은 `.gitignore`
- [ ] 시크릿은 절대 커밋 금지

## 6. 로컬 개발 (착수 후)
```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

## 7. 셋업 완료 체크
- [ ] Meta 앱에서 ig_user_id 추출까지 수동 1회 성공(토큰 흐름 검증)
- [ ] Supabase 익명인증으로 행 생성/RLS 격리 확인
- [ ] Vercel 배포 1회 성공
