# Claude 작업 이어받기 안내 (Codex용)

> 사용자 지시(2026-10-04): Claude의 작업 한도가 끝나면 **Codex가 이 문서를 보고 Claude의 작업을 이어 간다.** Claude는 큰 단계마다 이 문서를 갱신한다. 마지막 갱신: 2026-10-04.
>
> Codex가 이미 [치료사 데이터 작업](CODEX_THERAPIST_DATA_TASK.md)을 하고 있다면, 그 작업을 커밋·push한 뒤 아래를 이어 간다. 두 작업의 파일 경계는 그 문서의 "Claude와 겹치지 않게"를 따른다.

> **Codex 갱신(2026-10-04):** 사용자가 Claude 자동 재개를 중지했다고 확인했다. 대표 게임의 절차형 3D 장면과 근거·포스터 문안을 별도 worktree에서 준비·검사했다. 변경 파일·검사·남은 일은 [Codex 이어받기 기록](CODEX_CONTINUATION_2026-10-04.md)을 먼저 읽는다. 커밋·push·병합은 아직 하지 않았다.

## 먼저 읽을 것

1. [로드맵](../ROADMAP.md): Phase 상태, 승인된 결정, 범위 정리, 작업 분담.
2. [동결 계약](../audit/FROZEN_CORE_CONTRACT.md): 동결 경로를 바꾸려면 변경 파일·이유·계약 영향·회귀 명령을 보여 주고 사용자 승인을 받는다.
3. [Claude 이어하기 기록 07](dudu_2026-10-03/07_CLAUDE_FLOW_AND_3D.md), [3D 제작 자료](../../assets/dudu3d/README.md), [디자인 레퍼런스](../research/2026-10-04_design_references.md).

## 브랜치와 작업 폴더

- Claude 작업 브랜치: `claude/dudu-followup`(origin에 push됨). Claude 작업 폴더: `C:\Users\kor02\orca\workspaces\s_project\dudu_claude`. 이 폴더를 그대로 이어 쓰거나 같은 브랜치로 새 worktree를 만든다.
- `main`에는 Phase 1까지 병합됐다(PR #9). `main`에 직접 push하지 않는다. 기능 병합은 PR로 하고 사용자 확인을 받는다.
- 원래 Orca 폴더(`C:\Users\kor02\orca\s_project`, `fix/phase1-clinical-integrity`)의 미커밋 파일은 건드리지 않는다.

## 사용자가 정한 것 (2026-10-04)

- **대표 게임:** `빛의 마법`(/ㅅ/ 지속 → 독립 → 연속성 → 반복 시작 → 음절 전이) 하나를 **전부 3D로** 완성한다. 치료 과제·5라운드 파라미터는 바꾸지 않고 연출만 3D로 만든다. 나머지 게임은 지금 상태를 유지한다.
- **포스터:** 게임이 아니라 **언어치료가 주인공**이다. 왜 게임으로 했는지(연습량, 즉각적 시각 피드백, 동기, 단계, 치료사 결정권)를 근거와 함께 보여 준다. 근거 조사 결과는 `docs/research/`에 둔다.
- **3D 최종 모델:** Meshy Pro 웹에서 사용자가 생성하고(대학 허락 확인됨), 결과를 `assets/dudu3d/meshy_output/`에 넣으면 Blender로 정리·리그·동작을 만든다. 앱 연결 시 GLTFLoader 도입은 사용자 승인 후. C 드라이브 여유 공간 확보가 필요하다.
- **범위 정리 승인:** ① legacy 진행 그래프(Codex 작업에 포함), ②③ seed를 V2로 다시 쓰고 legacy 모험 제거, ⑤ 문서·자산 정리. ④ legacy 추천 생성 중단은 보류(코드·표·거절 화면 유지).
- **매직빔 철회**는 다음 라운드부터 적용(구현·테스트 완료).

## 진행 상태 (Claude)

| 작업 | 상태 | 메모 |
|---|---|---|
| Phase 1 검토·병합 | 완료 | PR #9 |
| 로드맵·연구 문서 | 완료 | `docs/ROADMAP.md`, `docs/research/` |
| 흉장 재현·캐릭터 디테일 | 완료 | `src/tiger/duduEmblem.ts`, `DuduModel.tsx`, 검토 화면 `/dudu-review.html?action=WAVE&close` |
| 사용처 없는 코드 정리 | 완료 | Phase 0.5 승인분 포함 |
| Meshy 입력 이미지 | 완료 | `assets/dudu3d/meshy_input/` |
| seed V2 재작성 + legacy 모험 제거 | 대기 | 에이전트가 한도 오류로 종료. 인수 시 로컬 분리 브랜치·부분 구현 없음. 독립 작업으로 계속 |
| 빛의 마법 전체 3D | 절차형 구현·자동검사 완료, 사람 검수 전 | Codex가 3D 논·하늘·빔·5라운드 장면 구현. 최종 Meshy 모델·실기기 검수는 대기 |
| 임상 근거 조사·포스터 문안 | 문안 작성 완료, 사람 검토 전 | `docs/research/2026-10-04_clinical_rationale_and_poster.md`. 효과 검증과 설계 가설 구분 |
| Meshy 결과 Blender 정리 | 대기 | 사용자의 Meshy 결과와 디스크 공간 필요 |
| 문서·자산 정리(⑤) | 대기 | 루트 옛 프롬프트 4개 → `docs/history/`, 참조 없는 포스터 양식·제작 스크립트 정리 |

## 검사 명령

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests -q --basetemp backend\test-temp\run1 -p no:cacheprovider
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
backend\.venv\Scripts\python.exe backend\scripts\smoke_api.py   # DEMO 서버(SEED_DEMO_DATA=true, COOKIE_SECURE=false) 실행 중
git diff --check
npm.cmd audit
```

실행하지 못한 검사는 통과로 적지 않는다. 실제 마이크·3D 시각 충실도·임상 효과는 사람이 따로 검수한다. 기록은 한국어로 남긴다.
