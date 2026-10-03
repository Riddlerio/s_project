# 두두 작업 인수 · 2026-10-03

이 폴더는 다른 기기에서 `feat/dudu-mascot-3d-ui` 브랜치를 받아 작업을 이어가기 위한 묶음이다. **실제 앱 변경은 저장소 루트의 `src/`와 `backend/`에 있다.** `01`~`04`는 최초 인수 당시 스냅샷이고, 그 뒤의 구현·검사는 `05`, Orca에서의 안전한 명령과 Claude Code 프롬프트는 `06`을 따른다. `sources/`의 동기화 문서는 수정하지 않았다.

## 먼저 볼 파일

1. [01_LOCAL_PROGRESS.md](01_LOCAL_PROGRESS.md): 어느 브랜치에서 무엇을 구현·검증했고 무엇이 아직 연결되지 않았는지.
2. [02_DUDU_3D_TARGET.md](02_DUDU_3D_TARGET.md): 새로 받은 이미지 3장과 원래 도안을 비교한 **최종 3D 제작 기준**. 현재 캐릭터는 최종 모델이 아니다.
3. [03_WEEK_SCOPE.md](03_WEEK_SCOPE.md): 1인·1주일 시연과 포스터의 구현 범위.
4. [04_FULL_ARCHITECTURE.md](04_FULL_ARCHITECTURE.md): 치료 게임·대화·치료사 권한·AI 하네스의 전체 연결.
5. [poster/speech_hero_poster_review.pptx](poster/speech_hero_poster_review.pptx)와 [미리보기](poster/poster_preview.png): 사용자 제공 90×120 cm 규격의 **검토본**. 이름·지도교수·전공은 빈칸이며, 승인 스킬·재료 제작·다른 기기 이어하기는 설계로 표시되어 있다.
6. [05_DEVICE_CONTINUATION.md](05_DEVICE_CONTINUATION.md): 새 기기에서 받은 사용자 승인·기능 구현·검사 상태. 원래 인수 시점 이후의 변경은 이 기록으로 확인한다.
7. [06_ORCA_CLAUDE_HANDOFF.md](06_ORCA_CLAUDE_HANDOFF.md): Orca 독립 작업 폴더·실행·검사 명령, Claude Code 첫 프롬프트, Figma MCP 확인·설치 안내.
8. [07_CLAUDE_FLOW_AND_3D.md](07_CLAUDE_FLOW_AND_3D.md): Claude가 `claude/dudu-followup`에서 한 실제 흐름 확인·오류 수정, 게임 효과, 절차형 3D 두두, 검사 결과와 남은 마이크 검수 절차.

## 다른 기기에서 받기

```powershell
git clone https://github.com/Riddlerio/s_project.git
cd s_project
git fetch origin
git switch --track origin/feat/dudu-mascot-3d-ui
```

이미 복제한 저장소라면 현재 변경을 `git status`로 확인한다. 미커밋 자료가 있는 Orca 폴더에서 강제 전환하지 말고 [독립 worktree 명령](06_ORCA_CLAUDE_HANDOFF.md)을 따른다. **`main`이나 `fix/phase1-clinical-integrity`에 자동 병합하지 않는다.**

앱 실행은 저장소 [README.md](../../../README.md)의 Windows 안내를 따른다. 프런트엔드 `npm.cmd install`, 백엔드 `backend/requirements.txt` 설치 후, 로컬 데모 DB에서만 `SEED_DEMO_DATA=true`, `COOKIE_SECURE=false`로 실행한다. 샘플 로그인은 화면의 DEMO 버튼을 사용한다. `backend/.env`, 데모 DB, API 키, 실제 아동 자료는 이 인수 묶음에 넣지 않았다.

## 자료의 역할

| 위치 | 내용 | 주장할 수 있는 범위 |
|---|---|---|
| `references/original_dudu_2d.jpg` | 사용자가 제공한 원래 백호 정면 도안 | 두두의 정체성·무늬·망토·흉장 기준 |
| `references/dudu_3d_target_front.png`, `dudu_3d_target_poses.png` | 새로 제공된 생성 이미지 | 둥근 조형·털/천 재질·동작 **목표**. 실행 모델은 아님 |
| `references/dudu_home_concept.png` | 새로 제공된 화면 생성 이미지 | 캐릭터 배치·인사 포즈·분위기 참고. 글자·수치·메뉴 요구사항은 아님 |
| `references/dudu_turnaround_front_side_back.jpg` | 2026-10-03 사용자가 추가한 정면·측면·후면 조형 도면(1300mm 입상·받침 200mm 표기)과 흉장 상세(368C, Malong Company 표기) | 측·후면 형태의 기준. 444×450px 저해상도라 곡면·세부 비례는 추정이 필요하다. 흉장 사용 권한은 별도 확인 |
| `references/dudu_official_sheet_poses.jpg` | 2026-10-03 사용자가 추가한 대구대학교 제2세대 캐릭터 두두 소개·기본형·응용형 포즈 모음 | 성격 설명과 동작·표정 참고. 응용형의 소품·문구(학위모·깃발·축제 문구 등)는 요구사항이 아님 |
| `screenshots/actual_*.png` | 별도 샘플 DB로 촬영한 실제 앱 | 새 화면과 현재 2.5D 캐릭터의 실행 증거. 임상 효과·스킬 권한 증거는 아님 |
| `poster/` | 편집 가능한 PPTX·제공 양식·미리보기·제작 코드 | 제출 전 재검토할 시안 |

2026-10-03 추가 자료로 측·후면 **도면**은 받았다. 이 도면으로 `Hoya3D`의 내부 모델을 절차형 3D(`src/tiger/DuduModel.tsx`)로 바꿨다([07](07_CLAUDE_FLOW_AND_3D.md)). 편집 가능한 모델 파일(`.blend`·`.glb`)은 아직 없으므로 최종 모델은 아니다. 두 도면의 원본 파일은 사용자의 Orca 원래 작업 폴더 `두두 참고자료/`에 있다.

편집 가능한 [Figma 설계판](https://www.figma.com/design/TtG2zP2Sfa9GtCcePqSrGu)에는 원본과 실제 홈·게임 화면, 치료사 스킬 승인 **시안**이 함께 있다. Figma 화면을 앱의 작동 증거로 쓰지 않는다.

`poster/build_poster_source.mjs`는 이번 로컬 작업의 제작 소스다. 전용 `@oai/artifact-tool` 런타임과 환경 변수(`POSTER_TEMPLATE`, `POSTER_WORKSPACE`, `SKILL_DIR`, `RUNTIME_PYTHON`, `SOURCE_SHA256`)를 요구하고 이전 작업 폴더 구조를 참조한다. 다른 기기에서는 PPTX를 직접 편집하거나 경로와 환경을 맞춘 뒤 다시 생성한다. 이 스크립트를 일반 Node 프로젝트에서 바로 실행되는 명령으로 소개하지 않는다.

## 최초 인수 시점의 기준

최초 인수 브랜치는 `fix/phase1-clinical-integrity`의 `83bf0dd`에서 분기했다. 이후 사용자가 동결 변경 범위를 각각 승인했고, 새 기기 작업에서 음성 교대·스킬 권한·재료·이어하기 코드를 수정했다. 현재 계약 영향과 검사 상태는 [05_DEVICE_CONTINUATION.md](05_DEVICE_CONTINUATION.md)에 있다. 앞으로도 [동결 계약](../../audit/FROZEN_CORE_CONTRACT.md)은 변경 전 **파일·이유·계약 영향·회귀 명령을 제시한 사용자 승인**을 요구한다.
