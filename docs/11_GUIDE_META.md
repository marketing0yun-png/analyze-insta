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

## 트러블슈팅
| 증상 | 원인 | 해결 |
|---|---|---|
| "연결된 IG 비즈니스 계정을 찾지 못함" | IG가 개인 계정 / 페이지 미연결 / 스코프 누락 | STEP 3·4 재확인, STEP 7에서 권한 체크 |
| `me/accounts` 가 `{"data": []}` (페이지 ID 직접 조회는 IG까지 나옴) | 새 페이지 환경인데 `business_management` 누락 / 토큰 발급 시 페이지 옵트인 안 함 | STEP 6에 `business_management` 추가(권한 4개) → STEP 7-5 "설정 수정"으로 페이지·IG 옵트인 후 **토큰 재발급** |
| 토큰 발급은 됐는데 페이지가 안 잡힘 | "계속"으로 페이지 선택 건너뜀 / 토큰 계정이 페이지 관리자 아님 | "설정 수정"으로 옵트인 / 페이지를 만든 프로필로 토큰 발급(STEP 4 주의 참고) |
| 토큰 만료(code 190) | 단기 토큰이 만료됨 | 새 토큰 재발급, STEP 8로 장기 교환 활성 |
| 권한 거부/검수 요구 | 일반 공개 모드 + Advanced Access 미승인 | 개발 모드 + 테스터 등록(STEP 6)으로 진행 |
| `me/accounts` 가 비어있음 | 관리 페이지 없음 / 페이지-IG 미연결 | STEP 2·4 |
| 외부 계정 조회 시 빈 값 | 상대가 개인 계정(비프로페셔널) | Business Discovery 불가 — 분석 대상에서 제외 |

## 보안 원칙 (요약 — `docs/06_AUTH_SECURITY.md`)
- 토큰은 **서버에서만** 처리, **AES-256-GCM 암호화** 저장, 프론트로 절대 안 보냄.
- `META_APP_SECRET`·service-role 키는 서버 환경변수 전용. 배포 시 **Vercel 시크릿**에만 등록.
