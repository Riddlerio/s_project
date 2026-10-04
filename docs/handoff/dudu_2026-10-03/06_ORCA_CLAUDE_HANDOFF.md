# Orca에서 Claude Code와 이어하기 · 2026-10-03

이 문서는 `feat/dudu-mascot-3d-ui`의 **코드 상태**를 Orca의 Claude Code와 나누어 검토하기 위한 명령과 첫 프롬프트다. `main`에는 병합하거나 push하지 않는다. 이 폴더의 `01`~`04`는 최초 인수 당시의 기록이고, [05_DEVICE_CONTINUATION.md](05_DEVICE_CONTINUATION.md)가 이번 구현과 검사 기록이다. 시작 전에 [동결 계약](../../audit/FROZEN_CORE_CONTRACT.md)을 읽는다.

## 안전한 작업 폴더 만들기

현재 `C:\Users\kor02\orca\s_project`의 `fix/phase1-clinical-integrity`에는 별도 미커밋 자료가 있다. 그 폴더에서 `reset`·`clean`·강제 브랜치 전환을 하지 않는다. 빈 경로를 골라 원격 기능 브랜치의 **독립 작업 폴더**를 만든다. 아래 경로가 이미 있으면 사용하지 말고 새 이름을 정한다.

```powershell
Set-Location C:\Users\kor02\orca\s_project
git status --short --branch
git fetch origin
git worktree add --detach C:\Users\kor02\orca\workspaces\s_project\dudu_claude origin/feat/dudu-mascot-3d-ui
Set-Location C:\Users\kor02\orca\workspaces\s_project\dudu_claude
git switch -c claude/dudu-followup
git status --short --branch
```

`claude/dudu-followup`이 이미 있다면 새 작업 브랜치 이름을 정한다. Codex와 Claude가 같은 checkout의 같은 파일을 동시에 수정하지 않는다. 서로의 변경을 받을 때는 먼저 각자 커밋과 변경 파일 목록을 비교하고, 원격 추적 브랜치를 다시 가져온 뒤 충돌을 확인한다. `git pull --ff-only`를 우선 사용하고 강제 push는 하지 않는다. 기능 브랜치에 다시 합치는 결정도 현재 변경 범위와 검사 결과를 검토한 뒤 한다.

## 실행·검사 명령

프로젝트 루트에서 `npm.cmd ci`로 프런트 의존성을 설치한다. 백엔드는 [루트 README](../../../README.md)의 Windows 가상환경·의존성 설치 절차를 따른다. DEMO 서버는 **별도 샘플 DB**와 `SEED_DEMO_DATA=true`, `COOKIE_SECURE=false`로만 연다. 실제 아동 자료, `backend/.env`, API 키, 샘플 DB는 커밋하지 않는다. 서버와 프런트는 서로 다른 터미널에서 실행한다.

```powershell
Set-Location C:\Users\kor02\orca\workspaces\s_project\dudu_claude
npm.cmd ci
npm.cmd run dev
```

```powershell
Set-Location C:\Users\kor02\orca\workspaces\s_project\dudu_claude\backend
$env:SEED_DEMO_DATA = 'true'
$env:COOKIE_SECURE = 'false'
$env:DATABASE_URL = 'sqlite:///./dudu_orca_demo.db'
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
Set-Location C:\Users\kor02\orca\workspaces\s_project\dudu_claude
backend\.venv\Scripts\python.exe -m pytest backend\tests -q --basetemp backend\test-temp\orca-full -p no:cacheprovider
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
backend\.venv\Scripts\python.exe backend\scripts\smoke_api.py
npm.cmd audit
git diff --check
```

`smoke_api.py`는 위 DEMO 서버가 실행 중이어야 한다. Windows에서 검사 임시 경로 권한 오류가 나면 그 결과를 제품 실패로 해석하지 말고 새 `--basetemp` 경로로 재실행해 원인을 구분한다. 수치·화면 검증 결과는 실행 날짜와 환경을 함께 적는다. 실제 마이크에서 성인이 직접 발화하고 두두 음성을 들어보는 검수는 아직 남아 있다.

## Claude Code와 Figma 연결 확인

2026-10-03 이 기기에서 `claude --version`은 `2.1.288`이었고, `claude mcp list`는 **No MCP servers configured**, `claude plugin list`는 **No plugins installed**였다. Orca를 시작할 때 다시 확인한다. Figma 계정 연결이 없다면 연결됐다고 주장하지 말고 사용자에게 짧은 설치·인증 안내를 보낸다. [Figma의 Claude Code 공식 안내](https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server)는 원격 서버용 플러그인 설치 `claude plugin install figma@claude-plugins-official`, Claude Code 재시작, `/plugin`의 Installed 탭에서 Figma 인증을 안내한다. 로그인·접근 승인은 사용자가 직접 한다. 그 전에도 저장소의 참고 이미지와 실제 코드 검토는 진행할 수 있다. [Figma 설계판](https://www.figma.com/design/TtG2zP2Sfa9GtCcePqSrGu)과 포스터는 시안이며 작동 증거가 아니다.

## Claude Code에 보낼 첫 프롬프트

아래 문단 전체를 독립 작업 폴더에서 Claude Code에 전달한다.

> Speech Hero를 `origin/feat/dudu-mascot-3d-ui`에서 이어서 작업하려고 합니다. 먼저 `git status`, 현재/원격 커밋과 변경 파일을 확인하고, `docs/handoff/dudu_2026-10-03/README.md`, `01_LOCAL_PROGRESS.md`, `02_DUDU_3D_TARGET.md`, `03_WEEK_SCOPE.md`, `04_FULL_ARCHITECTURE.md`, `05_DEVICE_CONTINUATION.md`, `06_ORCA_CLAUDE_HANDOFF.md`, `docs/audit/FROZEN_CORE_CONTRACT.md`를 읽어 코드와 대조해주세요. `01`~`04`는 과거 스냅샷이므로 `05`의 구현·검사 기록과 실제 코드가 우선입니다. Codex와 작업을 나누기 전에 이 독립 worktree의 변경 범위, 겹칠 파일, 구현 순서를 제안하고 제 의견이 필요한 제품/임상 결정을 질문해주세요. 미커밋 변경을 덮거나 `main`에 병합·push하지 마세요.
>
> 현재 `Hoya3D.tsx`는 최종 모델이 아닌 2.5D 시제품입니다. `references/original_dudu_2d.jpg`가 정체성 기준이고 정면·포즈 목표 이미지와 홈 이미지는 조형·배치 참고입니다. 이미지 속 글자·수치를 요구사항으로 옮기지 마세요. 측·후면 원화와 모델 파일을 받기 전 최종 3D라고 주장하거나 임의로 제작하지 말고 임시 설계로 표시하세요. 기존 네 활동·각 다섯 라운드, 치료사의 임상 결정권, 기본 공격만으로 클리어하는 경로, DEMO/REAL 구분을 유지하세요. 이번 데모는 승인 매직빔, 명시적 기기 이어받기, 농사/낚시 재료와 참치초밥 한 레시피, 참여별을 포함합니다. 실제 구현과 Figma·포스터 시안을 구별하고, 남은 실제 마이크 검수는 완료로 표시하지 마세요.
>
> 먼저 `claude mcp list`와 `claude plugin list`로 Figma 연결을 확인해주세요. 없으면 **저에게 설치가 필요하다는 메시지**를 보내고 공식 Figma 안내 링크와 `claude plugin install figma@claude-plugins-official` 명령, 재시작 및 `/plugin` 인증 절차를 적어주세요. 제 Figma 로그인/승인이 필요한 단계는 기다리고, 그동안 저장소 코드·이미지의 독립 작업을 계속하세요. 동결 경로를 추가로 바꿔야 하면 변경 파일·이유·계약 영향·회귀 명령을 구체적으로 제시해 제 승인을 받기 전에는 수정하지 마세요. 필요한 테스트와 실제 화면을 확인하고 결과·남은 문제를 사실대로 보고해주세요.

## 오래된 Markdown의 처리

루트에 있던 `SPEECH_HERO_TASK.md`, `SPEECH_HERO_HOYA_ADAPTIVE_CHAT_FINAL_PROMPT.md`, `THERAPIST_WORKFLOW_PROMPT.md`, `SPEECH_HERO_FINAL_RELIABILITY_DATASET_PRONUNCIATION_PROMPT.md`(2026-10-04 [`docs/history/prompts/`](../../history/prompts/)로 이동)는 현재 실행 명령이 아닌 과거 입력 기록이다. [legacy 목록](../../audit/LEGACY_AND_PLACEHOLDER_REGISTER.md)에 네 파일이 등록돼 있고 발음 연구 보고서가 마지막 파일을 인용하므로 이번에는 삭제하지 않는다. `01`~`04`와 과거 V2 검증 기록도 당시 주장과 지금 구현의 차이를 추적하는 자료로 남긴다. 새 작업 지시는 이 문서와 `05` 및 실제 코드를 따른다.
