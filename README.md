# Meta SNS 트렌드 분석기

인스타그램(우선) · 쓰레드 · 페이스북 생태계의 **트렌드/경쟁 분석기**.
광고주(육아용품 매장)에게 정확한 경쟁·콘텐츠 인사이트를 제공하기 위한 도구.

> 자매 프로젝트: 네이버 생태계 분석기(완성), 유튜브 분석기(API 가능 확인). 이 저장소는 **Meta 생태계** 담당.

---

## 무엇을 하나

사용자가 **자기 Meta API 토큰**과 **분석할 외부 계정/해시태그**를 입력하면:

1. **계정 분석** — 경쟁 매장·인플루언서 계정의 업로드 루틴·참여율·해시태그·콘텐츠 포맷 분석
2. **콘텐츠 분석** — 캡션·미디어를 AI로 주제/소구점/카피톤 분류
3. **완전 분석** — 권한 위임받은 (광고주 본인) 계정은 노출·도달까지 포함한 심층 리포트
4. **해시태그 분석(보조)** — 태그 기반 게시물 수집 (토큰당 7일 30개 한도)

## 무엇을 못 하나 (중요)

- 외부(남의) 계정의 **노출/도달** → 확보 불가 (Meta 비공개 지표)
- 외부 계정의 **조회수·댓글내용** → 공식 API 불가, 서드파티(Phase 4)로만
- 자세한 가능/불가 경계: [`docs/02_CONSTRAINTS.md`](docs/02_CONSTRAINTS.md)

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트 | Next.js(React) + Tailwind + shadcn/ui, 반응형 + PWA |
| 배포 | Vercel |
| 백엔드/저장/인증 | Supabase (Postgres + Auth + Storage + RLS) |
| 수집 잡 | Supabase Edge Function / cron |
| 인증 | 익명인증 → 구글 로그인(배포 전 교체) |
| AI 분석 | Claude API (캡션·비전) |

## 문서

| 문서 | 내용 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | AI/개발자용 마스터 컨텍스트 (먼저 읽기) |
| [docs/01_PROJECT_OVERVIEW.md](docs/01_PROJECT_OVERVIEW.md) | 비전·목표·유즈케이스 |
| [docs/02_CONSTRAINTS.md](docs/02_CONSTRAINTS.md) | **실현가능성 매트릭스 (가장 중요)** |
| [docs/03_ARCHITECTURE.md](docs/03_ARCHITECTURE.md) | 시스템 구성·데이터 흐름 |
| [docs/04_DATA_MODEL.md](docs/04_DATA_MODEL.md) | DB 스키마 |
| [docs/05_META_API.md](docs/05_META_API.md) | Meta Graph API 참조 |
| [docs/06_AUTH_SECURITY.md](docs/06_AUTH_SECURITY.md) | 인증·토큰 보안 |
| [docs/07_ROADMAP.md](docs/07_ROADMAP.md) | Phase 계획·진행상태 |
| [docs/08_SETUP.md](docs/08_SETUP.md) | 환경 셋업 절차 |
| [docs/09_DECISIONS.md](docs/09_DECISIONS.md) | 의사결정 로그 |

## 현재 상태

🟡 **기획 완료 / 코드 미착수.** 개발 착수 대기. 다음 할 일은 [docs/07_ROADMAP.md](docs/07_ROADMAP.md) 참조.

## 빠른 시작 (개발 착수 후 채울 예정)

```bash
# 예정
npm install
cp .env.example .env.local   # Supabase / Meta 앱 키 입력
npm run dev
```

환경 구성 절차는 [docs/08_SETUP.md](docs/08_SETUP.md) 참조.
