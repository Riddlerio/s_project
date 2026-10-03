# Codex 작업 지시(제안) · 치료사 데이터 화면

> 상태: **사용자 확인 전 제안**이다. 사용자가 이 분담을 승인하면 이 문서 전체를 Codex에 전달한다. [로드맵](../ROADMAP.md)의 Phase 7 중 **읽기 화면**만 맡는다. 승인한 계획이 아이 게임을 구동하는 연결(계획 실행)은 이 작업에 넣지 않는다.

## 시작

```powershell
Set-Location C:\Users\kor02\orca\s_project
git fetch origin
git worktree add --detach C:\Users\kor02\orca\workspaces\s_project\codex_therapist_data origin/claude/dudu-followup
Set-Location C:\Users\kor02\orca\workspaces\s_project\codex_therapist_data
git switch -c codex/therapist-data-view
```

경로나 브랜치가 이미 있으면 새 이름을 쓴다. 원래 Orca 폴더(`fix/phase1-clinical-integrity` 체크아웃)의 미커밋 파일은 건드리지 않는다. `main`에 직접 push하지 않는다. 먼저 `docs/audit/FROZEN_CORE_CONTRACT.md`, `docs/ROADMAP.md`, `docs/research/2026-10-04_design_references.md`의 D절을 읽는다.

## 만들 것

1. **회기 타임라인:** 세션 상세에서 5라운드를 가로 띠로 놓고, 시도 하나를 점 하나로 표시한다.
   - 점 모양으로 출처를 구분한다: 시스템 측정, AI 추정, 치료사 확인·수정.
   - 점을 누르면 목표 낱말, 측정값 요약, 관찰 결과, 단서, 기존 확인·수정·거절 동작이 나온다. 기존 검증 API를 그대로 쓴다.
2. **목표별 추이:** 목표 음소·위치·수준별로 기준선과 최근 회기를 비교하고, 단서 단계를 겹쳐 보여 준다. 실제·DEMO·샘플은 섞지 않는다. 비교에는 실제·비샘플·치료사 확인 자료만 쓴다(Phase 1 규칙).
3. **데이터 품질 표시:** NO_SPEECH·UNCERTAIN·잡음·음질 POOR 시도에 표시를 붙이고, 성공률 분모에서 빠졌음을 적는다. 아동 음성 인식에는 한계가 있다는 고지를 둔다.
4. **결정 지원의 근거:** 회기 제안·활동 제안마다 입력 근거, 적용 규칙, 한계를 펼쳐 볼 수 있게 한다. 반영은 치료사가 고른 뒤에만 한다.
5. **세션 노트 텍스트:** 회기 요약을 복사해 기록지에 붙일 수 있는 짧은 글로 만든다. 서버가 계산한 값만 쓰고 LLM은 쓰지 않는다.

## 지켜야 할 것

- 게임 점수(별·XP·빔·높이·재료·스킬)는 이 화면에 임상 지표로 보이지 않는다.
- UNCERTAIN·NO_SPEECH는 실패가 아니며 분모에서 뺀다.
- 원음은 저장하지 않는다. 오디오 재생 기능은 만들지 않는다(동의 설계 전).
- 아동을 다루는 치료사 route는 모두 `owned_child`를 거친다. 새 API는 새 모듈(예: `backend/app/therapist_insights/`)의 router로 만들고, `main.py`에는 `include_router` 한 줄만 추가한다.
- 동결 경로(`therapist_planning/**`, `clinical/**`의 검증 상태, `models.py`)를 바꿔야 하면 변경 파일·이유·계약 영향·회귀 명령을 사용자에게 먼저 보여 주고 승인받는다.

## Claude와 겹치지 않게

- **Codex가 고치는 곳:** `src/therapist/**`, `src/api/therapist.ts`, 새 백엔드 모듈과 그 테스트, `src/styles/therapist.css`.
- **Codex가 고치지 않는 곳:** `src/child/**`, `src/tiger/**`, `src/styles/child.css`, `backend/app/adventure/**`, `backend/app/main.py`의 활동 흐름. Claude가 게임 구성과 3D를 맡는다.
- 작업 전후로 `git fetch origin` 후 `origin/claude/dudu-followup`과 변경 파일 목록을 비교한다.

## 검사와 보고

동결 계약 6절의 명령(백엔드 pytest, `npm.cmd test`, `typecheck`, `build`, DEMO 서버 `smoke_api.py`, `git diff --check`, `npm.cmd audit`)을 실행하고 결과를 날짜·환경과 함께 적는다. 실행하지 못한 항목은 통과로 적지 않는다. 화면은 샘플 DB(`SEED_DEMO_DATA=true`, `COOKIE_SECURE=false`)로 촬영한다. 기록은 한국어로 `docs/handoff/`에 남긴다.
