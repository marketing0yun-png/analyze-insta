# 11. Meta(Instagram) 설정 사용설명서 (상세)

> 인스타그램 공개지표를 가져오려면 Meta 쪽 준비가 필요하다. 순서가 꼬이면 토큰이 안 나오므로
> **아래 순서를 그대로** 따른다. 배경/제약은 `docs/02_CONSTRAINTS.md`, API 호출은 `docs/05_META_API.md`.

## 전체 그림 (왜 이렇게까지 하나)
인스타 Graph API는 **인스타 계정 단독으로는 안 되고**, 다음 4개가 묶여야 토큰이 나온다:

```
[Meta 비즈니스 포트폴리오]
        │  소유
        ▼
   [Facebook 페이지] ───연결─── [Instagram 프로페셔널 계정(비즈니스/크리에이터)]
        │
        ▼
   [Meta 개발자 앱] ──권한 동의──▶ [액세스 토큰]  ← 이걸 우리 앱에 입력
```

- 우리 앱에 넣는 **토큰 = "출입증"**. 그 토큰에 연결된 내 IG 계정의 `ig_user_id` 를 꺼내고,
  그 열쇠로 **남의 공개 비즈니스 계정**(Business Discovery)도 조회한다.
- ⚠️ 못 가져오는 것(애초에 약속 안 함): 외부 계정의 **노출·도달**(영영 불가), **조회수·댓글내용**(공식 불가).

---

## STEP 1. Meta 비즈니스 포트폴리오(Business Portfolio) 만들기
페이지/앱/자산을 묶는 상위 컨테이너. 이미 있으면 건너뛴다.

1. [business.facebook.com](https://business.facebook.com) 접속(개인 페이스북 계정으로 로그인).
2. **비즈니스 만들기** → 비즈니스 이름·본인 이름·업무용 이메일 입력 → 생성.
3. (선택) **비즈니스 인증(Business Verification)** 시작:
   - **설정 → 비즈니스 정보 / 보안 센터**에서 사업자 정보 제출.
   - ⚠️ **리드타임 김(수일~수주).** 일반 공개 배포 때 필요하므로 **지금 미리 착수** 권장.
   - 개발/테스트 단계(개발모드)는 인증 없이도 진행 가능.

---

## STEP 2. Facebook 페이지 만들기 (IG 연결의 필수 매개)
인스타 비즈니스 계정은 **반드시 페이스북 페이지와 연결**돼야 Graph API가 동작한다.

1. [facebook.com/pages/create](https://www.facebook.com/pages/create) 접속.
2. 페이지 이름/카테고리(예: 육아용품) 입력 → 페이지 생성.
3. 이 페이지가 STEP 1의 비즈니스 포트폴리오에 **소유**되도록 연결:
   - Business Suite → **설정 → 비즈니스 자산 → 페이지** 에 추가/소유 설정.

> 페이지에 콘텐츠가 없어도 된다. **연결 매개** 역할이면 충분.

---

## STEP 3. 인스타그램을 "프로페셔널 계정"으로 전환
개인 계정은 API로 조회 불가. **비즈니스 또는 크리에이터** 계정이어야 한다.

1. 모바일 **Instagram 앱** → 내 프로필 → **☰ → 설정 및 개인정보**.
2. **계정 유형 및 도구 → 프로페셔널 계정으로 전환**.
3. **비즈니스**(권장) 또는 **크리에이터** 선택 → 카테고리 지정 → 완료.

> Business Discovery로 **분석할 외부 계정(경쟁사/인플루언서)** 도 상대가 프로페셔널이어야 조회된다.
> 개인 계정은 상대 쪽이 전환하지 않는 한 조회 불가(우리가 어쩔 수 없는 부분).

---

## STEP 4. 인스타 계정 ↔ 페이스북 페이지 연결
1. **Instagram 앱** → 프로필 → **프로필 편집** 또는 **설정 → 비즈니스/크리에이터 → 페이지 연결**.
2. STEP 2에서 만든 **페이스북 페이지**를 선택해 연결.
3. (권장) **Business Suite → 설정 → 비즈니스 자산 → Instagram 계정** 에서도 해당 IG가 보이는지 확인.

> ⚠️ **"개인 페이스북 프로필 ↔ 인스타" 연결은 소용없다.**
> (페이스북 개인 **설정 및 개인정보 → 연결된 계정**에서 잇는 그것 = API와 무관)
> Graph API가 보는 건 오직 **"페이스북 페이지 ↔ 인스타 프로페셔널"** 연결이다. **반드시 페이지에 연결**할 것.
> 또 토큰 발급에 쓰는 계정이 **그 페이지의 관리자**여야 한다(페이지를 만든 프로필과 토큰 계정이 같아야 함).

### 여기까지 확인 체크
- [ ] 비즈니스 포트폴리오 존재
- [ ] 페이스북 페이지 존재 + 비즈니스에 소유됨
- [ ] IG = 프로페셔널(비즈니스/크리에이터)
- [ ] IG ↔ 페이지 연결 완료

---

## STEP 5. Meta 개발자 앱 만들기
1. [developers.facebook.com](https://developers.facebook.com) → 우상단 **내 앱 → 앱 만들기**.
2. 앱 유형: **비즈니스(Business)** 선택.
3. 앱 이름/이메일 입력, **STEP 1의 비즈니스 포트폴리오**와 연결 → 생성.
4. 앱 대시보드에서 제품 추가:
   - **Instagram**(Instagram Graph API / Instagram API with Facebook Login) **설정** 클릭.
   - 함께 **Facebook 로그인(Facebook Login)** 제품도 추가(토큰 발급 OAuth용).
5. **App ID / App Secret 확인**(아래 STEP 8에서 `.env.local` 에 입력):
   - **앱 설정 → 기본 설정(Basic)** 에서 **앱 ID**, **앱 시크릿(Show 클릭)** 복사.

---

## STEP 6. 권한(스코프) 준비
토큰에 다음 권한이 포함돼야 한다(`docs/05_META_API.md` §1):

| 권한 | 필수 | 용도 |
|---|---|---|
| `instagram_basic` | ✅ | IG 계정·미디어 기본 정보 |
| `pages_show_list` | ✅ | 내가 관리하는 페이지 목록(→ IG 계정 찾기) |
| `pages_read_engagement` | ✅ | 페이지 인게이지먼트 읽기 |
| `business_management` | ✅ | **새 페이지 환경 페이지를 `/me/accounts` 목록에 노출**(아래 ⚠️) |
| `instagram_manage_insights` | (Phase 3) | 위임계정 인사이트(노출·도달 등) |

> ⚠️ **`business_management`는 사실상 필수다 (2026-06 실전 검증).**
> 요즘 페이스북 페이지는 대부분 **새 페이지 환경(New Pages Experience) + 비즈니스 관리** 상태로 생성된다.
> 이 경우 `business_management` **없이** `/me/accounts` 를 호출하면 **`{"data": []}` 빈 배열**이 떠서
> IG 계정을 못 찾는다(페이지를 ID로 직접 조회하면 IG가 나오는데, 목록 열거에는 안 잡히는 게 증상).
> **권한 4개(`instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management`)를 전부** 넣어야
> `/me/accounts` 가 페이지를 정상 열거하고 `instagram_business_account` 가 따라온다.

- **개발 모드:** 앱에 **역할(테스터/개발자)로 등록된 계정**은 위 권한을 검수 없이 바로 쓸 수 있다.
- **일반 공개:** `instagram_basic` 등은 **Advanced Access** 필요 → **앱 검수 + 비즈니스 인증** 통과해야 함.
- 👉 MVP는 **개발 모드 + 테스터 등록**으로 진행하고, 배포 때 검수(`docs/07_ROADMAP.md` Phase 3 말미).

### 테스터 등록 (개발 모드에서 본인 계정 쓰기)
1. 앱 대시보드 → **앱 역할(App Roles) → 역할** 또는 **사용자 역할**.
2. 본인(또는 분석 담당) 페이스북 계정을 **테스터/개발자**로 추가 → 해당 계정에서 **수락**.

---

## STEP 7. 액세스 토큰 발급
가장 쉬운 방법은 **Graph API 탐색기(Graph API Explorer)**.

### 방법 A — Graph API 탐색기 (권장, 빠름)
1. [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer) 접속.
2. 우측 **Meta App**: STEP 5에서 만든 앱 선택.
3. **User or Page**: `User Token` 선택.
4. **Permissions(권한 추가)** 에서 STEP 6의 스코프 **4개를 모두** 체크:
   `instagram_basic`, `pages_show_list`, `pages_read_engagement`, **`business_management`**
   (Phase 3에서 위임 인사이트가 필요해지면 `instagram_manage_insights` 도).
5. **Generate Access Token** 클릭 → 페이스북 로그인/동의 팝업이 뜬다.
   - ⚠️ **여기서 "계속"을 바로 누르지 말 것.** "계속"은 페이지 선택을 건너뛰어
     `/me/accounts` 가 빈 배열로 나오는 원인이 된다.
   - **"설정 수정"** 을 눌러서:
     ① **페이지 선택** 화면 → **"모든 현재 및 향후 페이지에 옵트인"**(또는 분석에 쓸 페이지 직접 체크),
     ② **Instagram 계정 선택** 화면 → **"모든 현재 및 향후 Instagram 계정에 옵트인"**,
     ③ **비즈니스 접근 허용**까지 전부 동의 → **계속**.
   - ("**다른 계정 추가**"는 누르지 말 것 — 다른 페이스북 계정으로 로그아웃된다.)
6. 생성된 긴 문자열이 **단기 사용자 토큰**(~1시간). 이걸 복사.
7. (확인) 탐색기 주소창에
   `me/accounts?fields=name,instagram_business_account{id,username}` 실행 →
   페이지 목록과 함께 `instagram_business_account.id` 가 나오면 IG 연결 성공.
   (이게 우리 앱이 추출할 `ig_user_id`. `id,username` 은 **필드 이름 그대로** 입력 — 실제 값은 응답이 채워줌)
   - 빈 배열 `{"data": []}` 이면 → `business_management` 누락 또는 5번 페이지 옵트인 누락.
     `<PAGE_ID>?fields=name,instagram_business_account{id,username}` 로 직접 조회하면 연결 자체는 확인되지만,
     앱은 `/me/accounts` **열거**에 의존하므로 **권한 4개를 갖춰 재발급**해야 한다.

### 방법 B — 우리 앱에서 장기 토큰으로 교환 (자동)
- 위 단기 토큰을 **그대로 우리 앱 "인스타 토큰 연결"에 붙여넣으면**, 서버가
  `META_APP_ID/SECRET`(STEP 8 입력) 이 있을 때 **자동으로 장기 토큰(~60일)으로 교환**해 암호화 저장한다.
- 앱 시크릿이 아직 없으면 단기 토큰을 그대로 저장(만료 빠름) → STEP 8 먼저 권장.

### (참고) 토큰 종류
| 종류 | 수명 | 비고 |
|---|---|---|
| 단기 사용자 토큰 | ~1시간 | 탐색기에서 즉시 발급 |
| 장기 사용자 토큰 | ~60일 | 앱 ID/시크릿으로 교환. 우리 앱이 자동 처리 |
| 페이지 토큰 | 페이지별 | `/me/accounts` 응답에 포함(현재 흐름은 사용자 토큰 기반) |
| **System User 토큰** | **무기한(만료 안 함)** | 비즈니스 설정 → 시스템 사용자로 발급. **오너 토큰(체험 공유)용 권장 → STEP 10** |

> ⚠️ **탐색기 토큰은 전부 만료된다**(단기 1h / 장기 60일). 체험계정이 공유하는 **오너 토큰**은
> 만료되면 전체가 끊기므로 **무기한 System User 토큰**으로 발급해야 한다(STEP 10).

---

## STEP 8. `.env.local` 에 Meta 값 입력
프로젝트 루트 `.env.local` 을 열어 아래를 채운다(STEP 5에서 복사한 값):
```
META_APP_ID=<앱 ID>
META_APP_SECRET=<앱 시크릿>
```
- 채운 뒤 `npm run dev` 재시작.
- 이 값이 있으면: ① **appsecret_proof 서명**(토큰 오용 방어) ② **장기 토큰 자동 교환** 이 켜진다.
- 없어도: 토큰 **검증·`ig_user_id` 추출·암호화 저장**은 동작한다(장기 교환만 생략, 만료 빠름).
- ⚠️ 앱 시크릿은 **서버 전용 비밀**. 프론트 노출·커밋 절대 금지.

---

## STEP 9. 우리 앱에서 토큰 연결 (최종)
1. (선행) `docs/10_GUIDE_SUPABASE.md` STEP 1·2 완료 — 익명 로그인 ON + service-role 키.
2. `npm run dev` → `http://localhost:3000`.
3. **"인스타 토큰 연결"** 카드에 STEP 7의 토큰을 붙여넣고 **검증 후 연결**.
4. 성공 시: `ig_user_id`, `@username`, 토큰 만료일이 표시되고 상태가 **`연결됨`** 으로 바뀐다.
   - DB `analyze_insta_api_credentials` 에는 **암호화된 토큰**만 저장된다(평문 아님).

---

## STEP 10. (운영자 전용) 오너 토큰 = 무기한 System User 토큰 ⭐
> **용도:** 체험계정(로그인했지만 **개인 토큰 미연결**인 유저)의 외부 공개지표 수집을 **운영자(오너) 토큰으로 대행**한다(D-025).
> 공개 후에도 **체험 유저 전원이 이 토큰 하나를 공유**하므로 — **절대 만료되면 안 된다.**
> 탐색기 토큰(단기 1h / 장기 60일)은 결국 만료돼 부적합. **System User 토큰만 "만료 안 함"으로 발급된다.**
>
> 이건 **운영자 1회 셋업**이다. 일반 유저는 STEP 7~9(자기 토큰 연결)만 하면 된다.

**전제:** STEP 1~4 완료(비즈니스 포트폴리오 + 페이지 + IG 프로페셔널 + **IG↔페이지 연결**) + STEP 5(앱 생성).

### 10-1. 시스템 사용자 생성
1. [business.facebook.com/settings](https://business.facebook.com/settings) → **사용자 → 시스템 사용자** → **추가**.
2. 이름(예: `analyze-insta-owner`), 역할 = **직원(Employee) 액세스**.
   - ⚠️ 관리자(Admin)까지 줄 필요 **없다**(최소권한). 토큰 능력은 역할이 아니라 **아래 자산 할당**이 정한다.

### 10-2. 자산 할당 (3개 — 이게 핵심)
시스템 사용자 선택 → **자산 할당** → 자산 유형을 바꿔가며 아래 3개를 각각 추가:

| 자산 유형 | 선택 | 권한 |
|---|---|---|
| **앱** | STEP 5의 앱 | **앱 관리(전체 관리 권한)** — 토큰 생성에 필요 |
| **Facebook 페이지** | IG에 연결된 그 페이지 | **전체 제어** |
| **Instagram 계정** | 내 IG 비즈니스 계정 | **전체 제어** |

> ⚠️ **최대 함정(실전 검증 2026-06):** "시스템 사용자에 IG를 **자산 할당**"하는 것과
> "IG를 **페이스북 페이지에 연결**(STEP 4)"하는 것은 **완전히 다른 설정**이다.
> 자산만 할당하고 페이지 연결을 안 하면, 토큰이 유효해도 `/me/accounts` 에 `instagram_business_account` 가
> **안 붙어** "이 토큰에 연결된 인스타그램 비즈니스/크리에이터 계정을 찾지 못함" 에러가 난다.
> **반드시 STEP 4(IG↔페이지 연결)를 먼저** 끝낼 것. (자산 할당 ≠ 페이지 연결)

### 10-3. 무기한 토큰 생성
1. 시스템 사용자 화면 우상단 **토큰 생성**.
2. 앱 = STEP 5의 앱 선택.
3. **토큰 만료 → "만료 안 함(Never)"** 선택. ← **이게 핵심**(탐색기엔 이 옵션이 없다).
4. 권한 체크: `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management`, `instagram_manage_insights`.
5. 생성 → **그 자리에서 바로 복사**(다시 안 보여줌).

### 10-4. 자가진단 (env 에 넣기 전에 검증)
탐색기에 **이 토큰을 붙여넣고** 실행:
```
me/accounts?fields=name,instagram_business_account{id,username}
```
| 결과 | 판정 | 조치 |
|---|---|---|
| `instagram_business_account.id` 가 나옴 | ✅ 정상 | 10-5 진행 |
| 페이지는 나오는데 IG 필드 없음 | IG↔페이지 미연결 | **STEP 4** 후 재실행 |
| `{"data": []}` 빈 배열 | 페이지 미할당(10-2) 또는 `pages_show_list`/`business_management` 누락 | 자산 재할당 / 권한 갖춰 **재발급** |

### 10-5. 배포 환경변수에 등록
- **Vercel → 프로젝트 → Settings → Environment Variables**:
  - `META_OWNER_TOKEN` = 위 무기한 토큰
  - (선택) `META_OWNER_IG_USER_ID` = 자가진단에서 나온 `instagram_business_account.id`
    (지정하면 런타임 IG 해석을 건너뛴다)
- 저장 후 **반드시 Redeploy** 해야 반영된다(기존 배포는 구토큰을 안고 있음).

> **무기한 ≠ 절대 무효화 안 됨.** 페이지 연결 해제·권한 회수·비밀번호 변경 등이 생기면 깨질 수 있다.
> 단 **"시간이 지나서 만료"는 없다** — 자산 구성을 안 건드리는 한 계속 유효.

---

## STEP 11. (사용자 간편 발급) OAuth 버튼 토큰 발급 — Facebook Login for Business ⭐
> **용도:** STEP 7(탐색기 수동 발급)을 대체할 일반 사용자용 간편 발급(D-031).
> 사용자는 **"Facebook으로 연결" 버튼 → 페북 로그인/동의 → 끝.** 서버가 자동으로 장기 토큰 교환·암호화 저장.
> **Meta 대시보드 셋업(11-1~11-3)은 2026-06-10 완료. 11-4에서 중단, 코드(11-5)는 미착수.**

### 진행 체크리스트 (2026-06-10 기준)
- [x] **11-1** 제품 추가 (비즈니스용 Facebook 로그인)
- [x] **11-2** 로그인 구성 생성 → `config_id` 발급 + `.env.local` 반영
- [x] **11-3** 설정 (OAuth 토글 + 리디렉션 URI)
- [ ] **11-4** `public_profile` 고급 액세스 (개인정보처리방침 URL 등록 선행) ← **재개 지점**
- [ ] **11-5** 코드 구현 (라우트 2개 + 버튼)
- [ ] **11-6** 테스터 등록 (시범 사용자용)
- [ ] **11-7** Vercel 환경변수 + Redeploy

### 11-1. 제품 추가 ✅
앱 대시보드([developers.facebook.com](https://developers.facebook.com) → `test_분석용앱`, 앱 ID `2942222376119807`)
→ "내 제품"에 **비즈니스용 Facebook 로그인** 추가됨(Instagram 제품과 나란히 표시되면 OK).

### 11-2. 로그인 구성(Configuration) ✅
**비즈니스용 Facebook 로그인 → 구성 → 구성 만들기** 마법사:

| 단계 | 선택값 |
|---|---|
| 로그인 버전 | **Instagram 그래프 API** (General ❌ — 생성 후 변경 불가, 잘못 골랐으면 구성 삭제 후 재생성) |
| 액세스 토큰 | **사용자 액세스 토큰** (System-user ❌ — 그건 오너 토큰용 STEP 10) |
| 권한 (5개) | `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management`, `instagram_manage_insights` |

발급된 **구성 ID(config_id)** — 시크릿 아님(OAuth URL에 공개 노출되는 값):
```
1407928874437388
```
- `.env.local` 에 `META_LOGIN_CONFIG_ID=1407928874437388` **반영 완료**.

### 11-3. 설정(Settings) ✅
**비즈니스용 Facebook 로그인 → 설정**:
- 클라이언트 OAuth 로그인 **예** · 웹 OAuth 로그인 **예** · HTTPS 적용 **예** · 리디렉션 URI Strict 모드 **예**
- 웹 OAuth 재인증 · 포함(embed)된 브라우저 · 기기에서 로그인 · JavaScript SDK 로그인 = 전부 **아니요**
- **유효한 OAuth 리디렉션 URI** 등록값:
```
https://analyze-insta.vercel.app/api/meta/oauth/callback
```
- localhost 는 **개발 모드에서 등록 없이 자동 허용**(이 칸은 https 만 입력 가능하므로 넣지 않는다).

### 11-4. `public_profile` 고급 액세스 🔲 ← 재개 지점
설정 화면 상단 노란 배너: *"Facebook Login for Business 사용에는 public_profile 고급 액세스 필요."*
**클릭 한 번짜리 전환이며 앱 검수(심사 제출)와 다르다.** 단, **개인정보처리방침 URL 등록이 선행 조건**
(미등록 시 "개인정보처리방침 URL 오류" 팝업으로 거부됨 — 실측 2026-06-10).

1. **앱 설정 → 기본** 에서 입력 후 **변경 내용 저장**:
   - 개인정보처리방침 URL: `https://analyze-insta.vercel.app/privacy` (D-026 때 배포됨, 200 확인)
   - 서비스 약관 URL: `https://analyze-insta.vercel.app/terms` (선택이지만 권장)
   - 사용자 데이터 삭제: **"데이터 삭제 안내 URL"** 선택 → `https://analyze-insta.vercel.app/privacy`
   - 카테고리(요구 시): **비즈니스 및 페이지**
2. **앱 검수 → 권한 및 기능** → `public_profile` 검색 → **"고급 액세스 요청"** 클릭.
3. ⚠️ 비즈니스 인증 등 **추가 요구가 뜨면 진행 중단**하고 화면 캡처 후 상의.

### 11-5. 코드 구현 계획 🔲 (라우트 2개 + 버튼)
- env: `META_LOGIN_CONFIG_ID`(반영 완료) + 기존 `META_APP_ID`/`META_APP_SECRET` — `env.ts`에 getter 추가.
- **`GET /api/meta/oauth/start`**: 로그인 세션 확인 → `state` 난수 생성(httpOnly 쿠키 보관) → 아래로 redirect:
```
https://www.facebook.com/v23.0/dialog/oauth
  ?client_id=<META_APP_ID>
  &config_id=<META_LOGIN_CONFIG_ID>
  &redirect_uri=<origin>/api/meta/oauth/callback
  &state=<난수>
  &response_type=code
```
- **`GET /api/meta/oauth/callback`**: `state` 쿠키 대조 → `code` 수신(10분 1회용) →
  `GET /oauth/access_token?client_id&client_secret&redirect_uri&code` 로 단기 토큰 교환 →
  기존 `exchangeLongLivedToken()`(`lib/meta/client.ts`, ~60일) → **기존 토큰 검증·암호화 저장 파이프라인 재사용** → 홈으로 redirect.
- `ConnectCard`에 **"Facebook으로 연결"** 버튼 추가 (수동 붙여넣기 입력은 폴백으로 유지).
- `redirect_uri` 는 요청 origin 기반으로 구성(localhost/프로덕션 겸용). **Strict 모드 = 등록 URI와 글자 단위 일치 필수.**

### 11-6. 테스터 등록 🔲
검수 전에는 **앱 역할 등록 계정만** OAuth 가능. **앱 역할 → 역할 → 테스터 추가**(시범 사용자의 페이스북 계정).
운영자 본인(관리자)은 등록 불필요. 불특정 다수 공개는 앱 검수(Advanced Access) 통과 후.

### 11-7. Vercel 환경변수 🔲
Vercel → 프로젝트 → Settings → Environment Variables:
```
META_APP_ID
META_APP_SECRET
META_LOGIN_CONFIG_ID=1407928874437388
```
저장 후 **Redeploy** (로컬 `.env.local` 은 로컬 전용).

> **(참고) Instagram API with Instagram Login(신형, 페이스북 페이지 불필요)은 기각** —
> 발급은 더 간편하나 **Business Discovery·해시태그 검색 미지원**이라 본 서비스 핵심(외부 계정 분석)이 동작 안 함.
> **Facebook Login for Business 고정.** (신형도 비즈니스/크리에이터 계정 전용인 건 동일)

---

## 트러블슈팅
| 증상 | 원인 | 해결 |
|---|---|---|
| "연결된 IG 비즈니스 계정을 찾지 못함" | IG가 개인 계정 / 페이지 미연결 / 스코프 누락 | STEP 3·4 재확인, STEP 7에서 권한 체크 |
| 토큰은 **유효(만료 아님)** 한데 "IG 계정 못 찾음" | IG를 시스템 사용자에 **자산 할당만** 하고 **페이지 연결(STEP 4)은 안 함** | **STEP 4**로 IG↔페이지 연결 → `/me/accounts` 자가진단 재확인(STEP 10-4). 자산 할당 ≠ 페이지 연결 |
| `me/accounts` 가 `{"data": []}` (페이지 ID 직접 조회는 IG까지 나옴) | 새 페이지 환경인데 `business_management` 누락 / 토큰 발급 시 페이지 옵트인 안 함 | STEP 6에 `business_management` 추가(권한 4개) → STEP 7-5 "설정 수정"으로 페이지·IG 옵트인 후 **토큰 재발급** |
| 토큰 발급은 됐는데 페이지가 안 잡힘 | "계속"으로 페이지 선택 건너뜀 / 토큰 계정이 페이지 관리자 아님 | "설정 수정"으로 옵트인 / 페이지를 만든 프로필로 토큰 발급(STEP 4 주의 참고) |
| 토큰 만료(code 190) | 단기 토큰이 만료됨 | 새 토큰 재발급, STEP 8로 장기 교환 활성 |
| 권한 거부/검수 요구 | 일반 공개 모드 + Advanced Access 미승인 | 개발 모드 + 테스터 등록(STEP 6)으로 진행 |
| `me/accounts` 가 비어있음 | 관리 페이지 없음 / 페이지-IG 미연결 | STEP 2·4 |
| 외부 계정 조회 시 빈 값 | 상대가 개인 계정(비프로페셔널) | Business Discovery 불가 — 분석 대상에서 제외 |
| "고급 액세스 요청" 클릭 시 **개인정보처리방침 URL 오류** 팝업 | 앱 기본 정보에 방침 URL 미등록 | **STEP 11-4 ①** (앱 설정→기본에 `/privacy` 등록·저장) 후 재시도 |
| OAuth 다이얼로그가 `redirect_uri` 불일치 거부 | Strict 모드에서 등록 URI와 글자 단위 다름 | STEP 11-3 등록값과 호출값 일치 확인(트레일링 슬래시 포함) |

## 보안 원칙 (요약 — `docs/06_AUTH_SECURITY.md`)
- 토큰은 **서버에서만** 처리, **AES-256-GCM 암호화** 저장, 프론트로 절대 안 보냄.
- `META_APP_SECRET`·service-role 키는 서버 환경변수 전용. 배포 시 **Vercel 시크릿**에만 등록.
