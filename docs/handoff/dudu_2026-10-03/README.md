# 두두 작업 인수 · 2026-10-03

이 폴더는 다른 기기에서 `feat/dudu-mascot-3d-ui` 브랜치를 받아 작업을 이어가기 위한 묶음이다. **실제 앱 코드 변경은 저장소 루트의 `src/`에 있다.** 이 폴더에는 Git에 없던 기획·포스터·참고 이미지·실행 캡처와 인수 설명을 넣었다. `sources/`의 동기화 문서는 수정하지 않았다.

## 먼저 볼 파일

1. [01_LOCAL_PROGRESS.md](01_LOCAL_PROGRESS.md): 어느 브랜치에서 무엇을 구현·검증했고 무엇이 아직 연결되지 않았는지.
2. [02_DUDU_3D_TARGET.md](02_DUDU_3D_TARGET.md): 새로 받은 이미지 3장과 원래 도안을 비교한 **최종 3D 제작 기준**. 현재 캐릭터는 최종 모델이 아니다.
3. [03_WEEK_SCOPE.md](03_WEEK_SCOPE.md): 1인·1주일 시연과 포스터의 구현 범위.
4. [04_FULL_ARCHITECTURE.md](04_FULL_ARCHITECTURE.md): 치료 게임·대화·치료사 권한·AI 하네스의 전체 연결.
5. [poster/speech_hero_poster_review.pptx](poster/speech_hero_poster_review.pptx)와 [미리보기](poster/poster_preview.png): 사용자 제공 90×120 cm 규격의 **검토본**. 이름·지도교수·전공은 빈칸이며, 승인 스킬·재료 제작·다른 기기 이어하기는 설계로 표시되어 있다.

## 다른 기기에서 받기

```powershell
git clone https://github.com/Riddlerio/s_project.git
cd s_project
git fetch origin
git switch --track origin/feat/dudu-mascot-3d-ui
```

이미 복제한 저장소라면 `git fetch origin` 후 위 `git switch --track ...`만 실행한다. 같은 이름의 로컬 브랜치가 있으면 `git switch feat/dudu-mascot-3d-ui`를 사용한다. **`main`이나 `fix/phase1-clinical-integrity`에 자동 병합하지 않는다.** 현재 구현·자료는 이 브랜치에서 검토한 뒤 통합한다.

앱 실행은 저장소 [README.md](../../../README.md)의 Windows 안내를 따른다. 프런트엔드 `npm.cmd install`, 백엔드 `backend/requirements.txt` 설치 후, 로컬 데모 DB에서만 `SEED_DEMO_DATA=true`, `COOKIE_SECURE=false`로 실행한다. 샘플 로그인은 화면의 DEMO 버튼을 사용한다. `backend/.env`, 데모 DB, API 키, 실제 아동 자료는 이 인수 묶음에 넣지 않았다.

## 자료의 역할

| 위치 | 내용 | 주장할 수 있는 범위 |
|---|---|---|
| `references/original_dudu_2d.jpg` | 사용자가 제공한 원래 백호 정면 도안 | 두두의 정체성·무늬·망토·흉장 기준 |
| `references/dudu_3d_target_front.png`, `dudu_3d_target_poses.png` | 새로 제공된 생성 이미지 | 둥근 조형·털/천 재질·동작 **목표**. 실행 모델은 아님 |
| `references/dudu_home_concept.png` | 새로 제공된 화면 생성 이미지 | 캐릭터 배치·인사 포즈·분위기 참고. 글자·수치·메뉴 요구사항은 아님 |
| `screenshots/actual_*.png` | 별도 샘플 DB로 촬영한 실제 앱 | 새 화면과 현재 2.5D 캐릭터의 실행 증거. 임상 효과·스킬 권한 증거는 아님 |
| `poster/` | 편집 가능한 PPTX·제공 양식·미리보기·제작 코드 | 제출 전 재검토할 시안 |

편집 가능한 [Figma 설계판](https://www.figma.com/design/TtG2zP2Sfa9GtCcePqSrGu)에는 원본과 실제 홈·게임 화면, 치료사 스킬 승인 **시안**이 함께 있다. Figma 화면을 앱의 작동 증거로 쓰지 않는다.

`poster/build_poster_source.mjs`는 이번 로컬 작업의 제작 소스다. 전용 `@oai/artifact-tool` 런타임과 환경 변수(`POSTER_TEMPLATE`, `POSTER_WORKSPACE`, `SKILL_DIR`, `RUNTIME_PYTHON`, `SOURCE_SHA256`)를 요구하고 이전 작업 폴더 구조를 참조한다. 다른 기기에서는 PPTX를 직접 편집하거나 경로와 환경을 맞춘 뒤 다시 생성한다. 이 스크립트를 일반 Node 프로젝트에서 바로 실행되는 명령으로 소개하지 않는다.

## 다음 검토의 기준

원본 `fix/phase1-clinical-integrity`의 `83bf0dd`에서 분기했다. 앱의 3D·화면층은 변경됐지만 동결 백엔드 계약은 변경하지 않았다. `docs/audit/FROZEN_CORE_CONTRACT.md`는 동결 경로 변경 전 **파일·이유·계약 영향·회귀 명령을 제시한 사용자 승인**을 요구한다. 특히 치료사 승인 스킬의 서버 권한, 재료 저장, 음성 순서는 [01_LOCAL_PROGRESS.md](01_LOCAL_PROGRESS.md)의 남은 작업에 따라 검토한다.
