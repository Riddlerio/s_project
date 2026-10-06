# Codex 작업 순서

2026-10-05 Claude가 작성했다(2026-10-06 4·5번 추가). 사용자가 "`docs/CODEX_TASKS.md` N번 이행하고 알려줘"라고 하면 **그 번호만** 한다.

## 상태

| 번호 | 할 일 | 상태 |
|---|---|---|
| 1 | 치료사 화면 시각이 9시간 이르게 보이는 오류 | 코드·CI 끝(`codex/therapist-fixes` `0c14ae3`), PR 대기 |
| 2 | 대화 없이 끝난 빈 대화 기록 숨기기 | 코드·CI 끝(1번과 같은 커밋), PR 대기 |
| 3 | 치료사 화면 시연 동선 점검과 작은 수정 | 대기. Claude C2가 main에 들어간 뒤 시작 |
| 4 | 1번 작은 마무리 2가지 + 1·2번 PR 열기 | **지금 가능** |
| 5 | 치료사 분석 그래프용 집계 API(읽기 전용) | **지금 가능**(Claude C3와 동시에) |

- **권장 순서: 4 → 5 → 3.** 4·5번은 지금 할 수 있고, 3번은 Claude C2(치료사 분석 화면)가 main에 들어간 뒤에 한다.
- 1·2번은 Codex가 2026-10-06에 `e3c25be` 기준으로 시작했다. Claude는 이 둘을 하지 않는다.
- `e3c25be`는 고치거나 rebase하지 않는다. main 병합은 squash가 아닌 merge commit으로 해서 이 커밋이 main 기록에 그대로 남게 한다.
- 같은 일을 두 번 하지 않도록 **시작 전에 main의 이 표를 다시 확인한다.**

## 공통 규칙 (모든 번호)

1. **시작 위치:** 최신 main에서 새 작업 폴더와 브랜치를 만든다(이미 `e3c25be`에서 시작한 1·2번은 그대로 둔다).
   ```powershell
   git fetch origin
   git worktree add ..\codex_task1 -b codex/task-1-timezone origin/main
   ```
   - 옛 폴더 `codex_therapist_data`(브랜치 `codex/therapist-rhythm`)는 쓰지 않는다.
   - 그 폴더의 미커밋 작업(아동별 박자 설정, 건너기 근거 문구)은 Claude가 그대로 옮겨 main에 넣었다(PR #17, `docs/audit/FROZEN_CORE_CONTRACT.md` 10절).
   - 처음 한 번만: 그 내용이 main에 있는 것을 확인한 뒤 옛 폴더와 브랜치를 지운다(`git worktree remove --force <옛 폴더>`, `git branch -D codex/therapist-rhythm`).
2. **고쳐도 되는 파일:** `backend/**`, `src/therapist/**`, `src/api/**`, 관련 테스트, 그리고 이 파일 상태 표의 자기 번호 줄.
3. **고치지 않는 파일(Claude 담당):** `src/child/**`, `src/game/**`, `src/speech/**`, `src/tiger/**`, `public/assets/**`, `shared/dudu_voice_lines.json`, `shared/design-tokens.json`, `backend/app/hoya/providers/demo_provider.py`(Claude C3 진행), `src/therapist/analytics/**`(Claude C2 진행). 꼭 필요하면 멈추고 사용자에게 알린다.
4. **동결 계약:** `docs/audit/FROZEN_CORE_CONTRACT.md`의 규칙을 지킨다. 동결 경로를 바꾸면 10절처럼 변경 기록 절을 하나 더한다.
5. **임상 원칙:**
   - 게임 점수와 자동 추정은 임상 판단이 아니다. 불확실·무발화는 실패가 아니다. 아동 화면에는 점수를 보이지 않는다.
   - 실행하지 않은 검사는 통과로 쓰지 않고 '미실행'으로 적는다.
6. **검사:** 모두 통과해야 PR을 만든다.
   ```powershell
   npm run typecheck; npm test; npm run build
   cd backend; New-Item -ItemType Directory -Force test-temp | Out-Null
   .venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp test-temp/ci
   cd ..; git diff --check
   ```
7. **커밋과 PR:**
   - 커밋 메시지와 PR은 한국어로 쓴다.
   - `git add .`는 쓰지 않고 파일을 골라 stage한다. `backend/.env`, DB 파일, 키는 커밋하지 않는다.
   - main에 직접 push하지 않는다. PR을 만들고 CI 통과를 확인한다.
   - PR 제목 끝에 "(CI 통과, 실제 기기 미확인)"을 붙인다. 병합은 사용자가 하거나, 사용자가 허락한 경우에만 한다.
8. **끝나면:**
   - 상태 표의 자기 번호를 '완료(PR #번호)'로 바꿔 같은 PR에 넣는다.
   - 사용자에게 아래 형식으로 짧게 보고한다.
   ```
   N번 완료: PR #__ (CI 통과 / 실패)
   바꾼 것: …
   검사: typecheck · npm test __개 · build · pytest __개
   미실행: …
   다음 작업자가 알 것: …
   ```

## 1번. 치료사 화면 시각 오류

**문제:** 치료사 화면의 회기·대화 시각이 9시간 이르게 보인다. 예를 들어 오후 6:42에 한 회기가 '오전 9:42'로 보인다.

**원인:**
- `backend/app/models.py`의 `now()`는 UTC 시각을 만든다. 그런데 SQLite는 시간대를 빼고 저장한다.
- 그래서 읽어 온 값에 시간대가 없고, `.isoformat()` 결과(`2026-10-05T09:42:00`)에도 시간대가 없다.
- 브라우저의 `new Date(...)`는 이것을 한국 시각으로 읽는다.
- 참고: `backend/app/game_settings/service.py`는 시간대가 없으면 UTC를 붙이는 처리를 이미 하고 있다.

**할 일:**
1. **백엔드:** 시간대 없는 값에 UTC를 붙여 `+00:00`이 있는 문자열로 바꾸는 함수를 하나 만든다. 응답에 시각을 넣는 곳(`git grep -n "isoformat()" backend/app`, 약 15곳)에 쓴다.
   - 날짜만 쓰는 곳(`therapist_insights/service.py`의 `started_at.date()`)은 한국 날짜로 바꾼 뒤 날짜를 뽑는다. 자정 근처에 날짜가 하루 어긋나지 않게 하기 위해서다.
2. **프런트:** `src/therapist/`에 시각 표시 함수 하나를 만든다. `toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })`을 쓴다.
   - 다음 곳의 `new Date(x).toLocaleString()`·`toLocaleDateString()`을 이 함수로 바꾼다: `ConversationInsights.tsx`, `GameSettingsPanel.tsx`, `pages/Overview.tsx`, `SkillGrantPanel.tsx`, `workspace/ProgressPanel.tsx`, `workspace/SummaryPanel.tsx`.
   - Claude C2도 `GameSettingsPanel.tsx`를 고친다. 시작 전에 main을 최신으로 받고, 충돌하면 두 변경을 모두 살린다.
3. **동결 계약:** `therapist_planning`의 응답 필드 이름은 그대로 둔다. 값에 시간대만 붙는다는 것을 FROZEN 문서에 새 절로 기록한다.

**완료 기준:**
- 백엔드 테스트: 알려진 UTC 시각으로 만든 회기의 `startedAt`이 `+00:00` 또는 `Z`로 끝난다.
- 프런트 테스트: `2026-10-05T09:42:00+00:00`이 '오후 6:42'를 포함해 보인다. 테스트 기기의 시간대와 상관없어야 한다.
- `git grep -n "toLocaleString()" src/therapist`의 결과가 0건이다.

## 2번. 빈 대화 기록 숨기기

**문제:** 치료사의 대화 기록 목록에 대화가 한 번도 오가지 않은 기록(완료된 턴 0개)이 섞여 목록이 어지럽다. 화면을 열었다 닫거나 새로 고친 경우에 생긴다.

**위치:** `backend/app/therapist_insights/conversation.py`(목록과 `completedTurnN`), `src/therapist/ConversationInsights.tsx`(표시)

**할 일:**
- 완료된 턴이 0개이고 진행 중(`status == "active"`)이 아닌 대화는 목록에서 뺀다. DB에서는 지우지 않는다.
- 뺀 개수를 `hiddenEmptyN`으로 응답에 더한다. 기존 필드는 그대로 둔다.
- 화면에는 한 줄로 "대화 없이 끝난 기록 N건은 숨겼습니다."라고 보인다. 0건이면 보이지 않는다.

**완료 기준:**
- 백엔드 테스트: 끝난 0턴 대화 1개, 3턴 대화 1개, 진행 중 0턴 대화 1개가 있으면 목록에 2개가 나오고 `hiddenEmptyN`은 1이다.
- 프런트 테스트: 숨김 안내 문구가 보인다.

## 3번. 치료사 화면 시연 동선 점검

**시작 조건:** Claude C2(근거 패널·빠른 설정)가 main에 들어간 뒤.

**준비:**
- `backend\scripts\demo_rehearsal.py provision --database <새 파일>.db`로 시연 DB를 새로 만든다.
- 서버와 화면을 띄운다(`docs/handoff/DEMO_RUNSHEET_2026-10-05.md`).

**순서:** 치료사 `demo-showcase` 로그인 → 최근 세션 → 방금 한 '대구대 건너기' 회기 → 회기 요약·자동 추정 근거 → 아동 화면의 '치료 목표' 탭(근거 패널, 박자 설정 저장) → 대화 기록.

**확인할 것:**
- 1280px와 390px 폭에서 가로 넘침과 겹침이 없다.
- 시각은 한국 시각이다.
- '판단 보류는 실패가 아님' 같은 표현이 화면마다 같다. 점수나 정확도처럼 읽히는 말이 없다.

**고칠 범위:** `src/therapist/**`의 작은 수정만 한다. 큰 변경은 보고만 한다.

**미실행 표시:** 브라우저로 확인하지 못하면 RTL 테스트로 대신하고, 보고서에 '브라우저 확인 미실행'으로 적는다.

## 4번. 1번 작은 마무리 + 1·2번 PR 열기

**작업 위치:** 1·2번과 같은 브랜치 `codex/therapist-fixes`(작업 폴더 `codex_fixes`). 새 브랜치를 만들지 않는다.

**할 일:**
1. 최신 main을 이 브랜치에 **merge**한다(rebase 아님): `git fetch origin; git merge origin/main`.
   - 2026-10-06 확인 결과, `e3c25be` 이후 main이 바꾼 파일과 이 브랜치가 바꾼 파일은 겹치지 않는다.
2. `src/therapist/GameSettingsPanel.tsx`의 '최근 저장' 시각을 `src/therapist/formatTime.ts`의 함수로 보인다. 지금은 `new Date(...).toLocaleString('ko-KR')`라 기기 시간대를 따른다.
3. `docs/audit/FROZEN_CORE_CONTRACT.md` 끝에 "11. 치료사 화면 시각·빈 대화(2026-10-06, Codex)" 절을 더한다. 적을 내용:
   - 서버 응답의 시각 형식은 그대로다(시간대 없는 UTC). 화면이 UTC로 읽어 서울 시각으로 보인다(`formatTime.ts`).
   - 회기 메모의 날짜는 서울 날짜다(`therapist_insights/service.py`).
   - 빈 대화는 치료사 목록에서만 숨긴다. DB는 그대로이고, 숨긴 개수는 `hiddenEmptyN`이다.
4. 이 파일 상태 표의 1·2·4번을 '완료(PR #번호)'로 바꾼다. 이 번호에서는 FROZEN 문서와 이 파일도 고쳐도 된다.
5. 검사를 모두 통과하면 push하고, main으로 PR을 연다.
   - PR 설명에 1·2·4번 내용과 검사 개수를 적는다.
   - CI 잡이 15분 뒤 '취소'로 끝나면 실패가 아니라 러너 대기다. 취소된 잡만 다시 돌린다: `gh run rerun <실행 번호> --failed`

**완료 기준:**
- `git grep -n "toLocaleString\|toLocaleDateString" src/therapist`가 `formatTime.ts` 밖에서 0건이다.
- PR의 CI가 통과한다.
- 병합은 사용자가 하거나 사용자가 허락한 경우에만, **merge commit**으로 한다.

## 5번. 치료사 분석 그래프용 집계 API (읽기 전용)

**왜:** 사용자 요청(10/6)은 "치료사가 데이터를 그래프로 효율적으로 보게"다. 그래프 화면은 Claude C2가 만들고, Codex는 자료를 주는 API와 타입을 만든다.

**작업 위치:** 최신 main에서 새 브랜치 `codex/crossing-analytics`. 4번이 병합된 뒤라면 그 main에서 시작한다.

**경로(제안):** `GET /api/therapist/children/{child_id}/crossing-analytics`
- `require_therapist`와 `owned_child`를 거친다. 다른 치료사의 아동이면 404다.

**응답(제안, camelCase):**
```json
{
  "sessions": [
    {
      "sessionId": "…", "startedAt": "…(지금 응답과 같은 형식)", "source": "REAL",
      "rhythm": { "startBpm": 84, "allowFaster": true },
      "attemptN": 10, "deferredN": 1, "reviewedN": 8, "confirmedSuccessN": 6, "confirmedRate": 0.75,
      "byLevel": { "syllable": { "reviewedN": 4, "confirmedSuccessN": 3 }, "word": { "reviewedN": 4, "confirmedSuccessN": 3 } },
      "autoReasons": { "ok": 6, "noFrication": 1, "shortFrication": 1, "noVowel": 0 }
    }
  ],
  "mastery": { "threshold": 0.8, "consecutiveSessions": 3, "met": false },
  "notes": ["회기 간 변화는 치료 효과의 증명이 아닙니다.", "DEMO 회기는 비율에서 뺍니다."]
}
```
- **`confirmedRate`:** REAL 회기에서 치료사가 확인·교정한 기록만 분모로 한다. 근거 필터는 동결 계약의 계획 근거 규칙과 같다(REAL, seed 아님, 마지막 결정이 confirm/correct). 불확실·무발화·음질 불량은 분모에서 뺀다. 확인한 기록이 없으면 `null`이다(0이 아님).
- **`autoReasons`:** 자동 추정 이유다. 화면 `onsetReason`과 같은 기준이다.
  - 시작 마찰 0 → `noFrication`
  - 기준 미만 → `shortFrication`
  - 모음 기준 미만 → `noVowel`
  - 판정 상수는 `games/evaluation.py`에서 읽기만 한다. 임상 판단이 아니다.
- **`mastery`:** 확인된 비율이 80% 이상인 REAL 회기가 연속 3회기인지 본다. 센터에서 흔히 쓰는 숙달 기준이며 제품 규칙이다. `HEURISTIC_REGISTER.md`에 등록한다.
- **`rhythm`:** 그 회기 시작 때의 스냅숏(`runtime_state.rhythm`)이다. 없으면 `null`이다. 회기 중 바뀐 빠르기는 저장하지 않는다(설계).
- **위치:** 건너기 낱말은 모두 어두 /ㅅ/이므로 위치별 집계는 넣지 않는다.

**프런트 연결(Codex):** `src/api/therapist.ts`에 `CrossingAnalytics` 타입과 `childCrossingAnalytics(childId)` 함수를 더한다. 그래프 화면(`src/therapist/analytics/**`)은 Claude가 만든다.

**지킬 것:**
- 새 표·열을 만들지 않는다(읽기만).
- 기존 응답과 경로는 그대로 둔다.
- DEMO는 비율 계산에서 빼고 `source`로만 보인다.

**완료 기준(테스트):**
- 다른 치료사의 아동이면 404다.
- DEMO 회기는 `confirmedRate` 계산에서 빠진다.
- 확인한 기록이 없는 회기는 `confirmedRate`가 `null`이다.
- 불확실·무발화는 분모에서 빠진다.
- `autoReasons` 세 가지가 맞게 분류된다.
- `mastery`: 연속 3회기면 `true`, 2회기면 `false`다.
- 전체 검사를 통과하고 PR의 CI가 통과한다.

## 참고: Claude 순서 (Codex가 피할 곳)

| 순서 | Claude 할 일 | 건드리는 곳 |
|---|---|---|
| C1 | Codex 미커밋 작업 인수, 아동 화면 다듬기, 문서 정리 | PR #17 |
| C2 | 치료사 근거 패널(왜 /ㅅ/·이 낱말·어떤 아동·무슨 치료), 빠른 설정 버튼, 분석 그래프 화면(5번 API 사용), 전문 정보 패널 | `src/therapist/GameSettingsPanel.tsx`, `src/therapist/analytics/**`(새), 새 근거 패널 파일, `shared/daegu_crossing_rationale.json` |
| C3 | (C2보다 먼저) 자연스러운 대화 대본("오늘 뭐 했어?"에서 /ㅅ/ 낱말이 나오게)과 새 두두 음성(VOLI) | `backend/app/hoya/providers/demo_provider.py`, `shared/dudu_voice_lines.json`, `public/assets/voice/**`, 아동 그림 단서 |
| C4 | 통합 점검(휴대폰 폭 전체 흐름)과 공용 문서 갱신 | README, ROADMAP 등 |
| C5 | 아이폰 리허설(사용자가 "리허설 할게"라고 할 때)과 수정 | `docs/handoff/DEMO_RUNSHEET_2026-10-05.md`의 리허설 확인 목록 |

지금까지 한 일과 중요한 결정은 [WORK_HISTORY.md](WORK_HISTORY.md)에 있다.
