---
name: dev-resume
description: 이 프로젝트(Meta SNS 트렌드 분석기) 개발을 중단 후 재개할 때의 컨텍스트 복원 체크리스트. 세션을 새로 시작했거나 어디까지 했는지 파악이 필요할 때 사용.
---

# 개발 재개 체크리스트

중단했다가 다시 이어할 때 이 순서로 컨텍스트를 복원한다. (토큰 절약: 필요한 문서만 연다.)

## 1. 현재 위치 파악 (먼저)
- `docs/07_ROADMAP.md`의 **"현재 상태" + "다음 할 일(Next Action)"** 확인 → 지금 어느 Phase인지.
- 미완료 체크박스가 바로 할 일.

## 2. 핵심 제약 재확인 (실수 방지)
- `CLAUDE.md`의 "⚠️ 절대 잊지 말 핵심 제약" 또는 `docs/02_CONSTRAINTS.md`.
- 특히: 외부 계정 노출/도달 불가, 토큰=출입증, 해시태그 7일/30개, 위임 vs 공개 분기.

## 3. 작업 종류별 참조 문서
| 하려는 일 | 열 문서 |
|---|---|
| API 수집 코드 | `/meta-api` 스킬 또는 `docs/05_META_API.md` |
| DB/스키마 | `docs/04_DATA_MODEL.md` |
| 인증/토큰/보안 | `docs/06_AUTH_SECURITY.md` |
| 시스템 구조/스택 | `docs/03_ARCHITECTURE.md` |
| 환경 셋업 | `docs/08_SETUP.md` |
| "왜 이렇게 했지?" | `docs/09_DECISIONS.md` |

## 4. 작업 후 갱신 (잊지 말 것)
- `docs/07_ROADMAP.md` 체크박스/다음 할 일 갱신.
- 새 결정 → `docs/09_DECISIONS.md`에 D-번호 추가.
- 스키마 변경 → `docs/04_DATA_MODEL.md` 갱신.
- 새 제약 발견 → `docs/02_CONSTRAINTS.md` 갱신.

## 5. 안전 규칙
- 토큰·시크릿 커밋 금지(`.env.local` gitignore).
- Meta 호출은 서버사이드만.
- 외부 계정에 노출/도달 표시 금지.
