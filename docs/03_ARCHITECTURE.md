# 03. 아키텍처

## 기술 스택
| 영역 | 선택 | 이유 |
|---|---|---|
| 프론트 | Next.js (React) + Tailwind + shadcn/ui + Recharts | 반응형·PWA·예쁜 UI, Vercel 최적 |
| 모바일 | 반응형 + **PWA** (단일 코드베이스) | 네이티브 앱 분리 불필요. 모바일 우선 레이아웃 |
| 배포 | Vercel | 프론트·가벼운 API |
| DB/인증/저장 | Supabase (Postgres + Auth + Storage + RLS) | 통합·재가공·권한분리 |
| 수집 잡 | Supabase Edge Function / cron(pg_cron 또는 외부 스케줄러) | Vercel 서버리스 타임아웃 회피 |
| AI 분석 | Claude API (claude-opus-4-8 / sonnet) | 캡션·비전 콘텐츠 분석 |
| 시크릿 | `.env.local` + Supabase Vault/암호화 컬럼 | 토큰 보호 |

## 시스템 구성도 (개념)
```
[사용자 브라우저/PWA]
        │  (HTTPS)
        ▼
[Next.js on Vercel]  ── UI + 서버사이드 API routes (인증·경량 호출)
        │
        ├──► [Supabase Auth]        익명인증 → 구글 로그인(link)
        ├──► [Supabase Postgres]    raw + 가공 데이터 (RLS)
        ├──► [Supabase Vault]       암호화된 Meta 토큰
        │
        ▼
[Supabase Edge Function / cron]  ── 무거운 수집 배치 (Meta API 폴링)
        │
        ▼
[Meta Graph API]  Business Discovery / Hashtag / Insights
        │
        ▼
(Phase 4) [서드파티 API]  조회수·댓글내용 보강
        │
        ▼
[Claude API]  콘텐츠 주제/카피 분석
```

## 핵심 설계 원칙
1. **토큰은 서버사이드에서만.** 프론트는 절대 Meta 토큰을 보지 않는다.
2. **화면(Vercel) ↔ 수집 잡(Supabase) 분리.** 대량 수집은 서버리스 타임아웃을 피해 배치로.
3. **raw / 가공 분리.** 원본 수집 테이블과 분석·리포트 테이블을 나눠 재가공 자유도 확보.
4. **rate limit 친화.** 모든 수집은 `X-Business-Use-Case-Usage` 헤더 모니터링 + 분산 스케줄.
5. **권한 등급 분기.** 위임 계정(완전분석) vs 외부 계정(공개지표)을 데이터·UI 모두에서 구분.

## 데이터 흐름 (Phase 1 기준)
1. 사용자가 토큰 등록 → 서버에서 검증·암호화 저장, `ig-user-id` 추출.
2. 사용자가 분석 대상(외부 계정 username / 해시태그) 등록.
3. 수집 잡이 스케줄에 따라 Business Discovery / Hashtag Search 호출 → raw 저장.
4. 가공 파이프라인이 지표 계산(참여율·주기 등) → 가공 테이블 저장.
5. (Phase 2) Claude API로 콘텐츠 분석 → `content_analysis` 저장.
6. 프론트가 가공 테이블을 읽어 대시보드 렌더.

## 배포 환경
- **Vercel**: Next.js 앱. 서버 함수 타임아웃 한계(Hobby ~10s / Pro ~60s) → 수집은 여기 두지 않음.
- **Supabase**: DB·인증·Storage·Edge Function(수집). cron으로 주기 수집.
- 환경변수: Supabase URL/anon key(프론트), service-role key·Meta 앱 시크릿(서버 전용).

## 모바일 전략
- **단일 코드베이스, mobile-first.** 컴포넌트 공유, 레이아웃만 반응형 분기.
- 모바일: 카드·탭·바텀시트·세로 차트 중심. 웹: 멀티컬럼 대시보드.
- **PWA**: manifest + service worker → 홈화면 추가, 앱처럼 전체화면.
- React Native 네이티브 앱은 진짜 필요 시 후속 검토(현재 범위 외).

## 향후 확장 지점
- 쓰레드/페북 어댑터(채널별 수집기 인터페이스를 추상화해두면 끼우기 쉬움).
- 서드파티 수집기(Phase 4)도 동일 인터페이스로 추가.
- 채널·소스 공통 스키마 → `docs/04_DATA_MODEL.md` 참조.
