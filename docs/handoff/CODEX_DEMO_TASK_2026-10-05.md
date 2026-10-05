# Codex 작업 지시 · 5일 데모의 서버·치료사 쪽 (2026-10-05)

사용자가 2026-10-05에 승인한 [5일 데모 설계안](DEMO_FLOW_PLAN_2026-10-05.md)을 Claude와 나눠서 만든다. Codex는 **서버 전부와 치료사 화면**, Claude는 **아이 화면·두두·게임 장면·목소리**를 맡는다. 먼저 설계안 전체를 읽는다.

## 1. 시작 상태와 작업 위치

- `claude/dudu-followup` = `9d61afd`. Codex PR #10(`dd54f5c`)을 빨리감기로 병합했다. 병합본에서 백엔드 pytest 324개, 프런트 176개, typecheck·build를 확인했다.
- 작업 폴더: `C:\Users\kor02\orca\workspaces\s_project\codex_therapist_data`. 새 브랜치 `codex/demo-server`를 `origin/claude/dudu-followup`에서 만든다. `dudu_claude` 폴더와 원래 Orca 폴더(`C:\Users\kor02\orca\s_project`, 사용자 미커밋 파일 있음)는 고치지 않는다.
- 서버 포트는 8000·5173·5181을 피한다(예: 8017). 테스트 임시 폴더도 따로 쓴다.
- 작업 전 Git 상태와 `AGENTS.md`를 확인한다. `main`에 push·병합하지 않는다. PR 기준 브랜치는 `claude/dudu-followup`이다.

## 2. 파일 경계 (동시에 같은 파일을 고치지 않는다)

| 담당 | 파일 |
|---|---|
| Codex | `backend/**` 전부(대화 대본·전환 신호, 새 게임 서버, 활동 제안·계획 heuristic, DEMO 계정), `src/therapist/**`, 새 API 필드에 필요한 `src/api/**` 타입 |
| Claude | `src/child/**`, `src/tiger/**`, `src/game/**`(새 게임 장면), `src/dev/**`, 두두 목소리(`src/speech/duduVoice.ts`, `koreanTts.ts`의 음성 선택), `voice-mic-check.html`, 아이 쪽 `GameKind` 타입(`src/control/speechGameSignal.ts`) |
| 공용 문서 | README·ROADMAP·DECISIONS_PENDING·FROZEN 계약은 Codex가 PR 마지막에 한 번 반영한다. Claude는 자기 인계 문서에만 적는다 |

## 3. 할 일

### A. 대화(`backend/app/hoya/**`): 유도 대화와 게임 전환 신호

1. **시작 문구:** "안녕~ 만나서 반가워! {별명}야. 나는 두두야." 별명은 아동의 `hero_name`이다. 실명은 쓰지 않는다. 아이 화면이 점프·자막·음성으로 보여 준다.
2. **DEMO 제공자 유도 대본:** 목표 낱말(기존 `conversation_candidates`)이 나오게 하는 질문을 쓴다. 기존 `Strategy` 값 안에서 다음 기법을 돌려 쓴다.
   - 선택 질문: "사과가 좋아, 수박이 좋아?"
   - 빈칸 채우기: "빨갛고 동그란 과일은 사…?"
   - 먼저 들려주고 권하기: "두두는 사과를 좋아해. 너도 말해 볼래?"
   - 아이 말을 바르게 다시 들려주기(고치라고 하지 않음): "맞아, 사과!"
   - 3턴 연속 무발화면 그림 선택 질문으로 쉽게 바꾼다.
   - 데모 목표는 /ㅅ/, 음절·낱말 단계다. 외부 LLM 없이 DEMO 제공자로 동작해야 한다.
3. **게임 전환 신호:**
   - 대화 세션마다 근거가 `TARGET_OBSERVED`인 턴 수를 센다. 이것은 "목표 낱말이 들어간 시도"이고 정확한 발음이 아니다(동결 규칙).
   - 다음 중 하나가 되면 그 턴의 두두 답을 전환 문구로 바꾼다: 시도가 10회이고 시작 후 2분이 지났을 때, 시작 후 5분이 지났을 때, 무발화로 쉬운 질문까지 했는데도 진행이 안 될 때.
   - 전환 문구: "우리 게임 해 볼까? 아래 '대구대 건너기'를 눌러 볼래?"
   - 아동 응답에는 **추가 필드 하나만** 더한다: `nextActivity: "daegu_crossing" | null`. 근거·전략·횟수 등 내부 정보는 아동 화면에 보내지 않는다(기존 원칙).
4. **동결 경로:** `hoya/**`는 FREEZE_WITH_EXCEPTIONS다. 응답 필드 추가와 전환 규칙은 사용자 승인 대상이다. 사용자는 데모 흐름(대화 10회 뒤 게임 안내)을 승인했다. 그래도 PR 설명에 바꾼 파일, 이유, 계약 영향(추가만 하고 기존 필드·상태 코드 유지), 회귀 명령을 적어 명시적으로 승인을 요청한다. 시작 문구·대본·횟수·시간은 heuristic이므로 `HEURISTIC_REGISTER.md`에 기록한다.
5. **치료사 쪽:** 세션 화면에서 "대화 중 목표 낱말 시도 n회"를 읽기 전용으로 볼 수 있게 한다(이미 보이면 확인만).

### B. 새 게임 `daegu_crossing` 서버

1. **게임 목록:** 활동 API의 게임 목록(`schemas.py` `StartActivityInput`, `session_state.py`의 `ActivityState`·`ActivityItem`)에 `daegu_crossing`을 더한다. 기존 4게임의 동작과 저장된 과거 상태는 그대로 둔다.
2. **5라운드 × 4줄(총 20줄):**

   | 라운드 | 항목 | 단서·독립성 | 치료 초점 |
   |---|---|---|---|
   | 1 두두 따라 건너기 | 같은 음절 4개(예: 사×4) | DIRECT_IMITATION, AUDITORY_MODEL | 단서에 따른 목표 소리 산출 |
   | 2 혼자 건너기 | 같은 음절 4개 | PROMPTED_PRODUCTION, VISUAL | 독립 산출 |
   | 3 모음 바꿔 건너기 | 사·소·수·시를 섞어서 | VISUAL | 모음 환경 바꾸기(무작위 연습) |
   | 4 낱말 건너기 | 사과·수박·소리·시소 | 그림 | 낱말 수준 |
   | 5 정문까지 | 음절 2 + 낱말 2 | 그림 | 혼합 |

   목표 단계가 낱말이면 1~3라운드도 낱말로 한다. 항목은 기존 낱말 목록(`training/content.py`)에서 가져온다.
3. **진행:**
   - 줄 하나마다 최대 3번 시도한다(처음 + 다시 2번).
   - `success`면 다음 줄로 간다. `retry`는 시도를 하나 쓴다. 3번을 다 쓰면 다음 줄로 넘어간다.
   - `uncertain`·`no_speech`는 시도를 쓰지 않고 같은 줄을 다시 낸다. 같은 줄에서 3번 연속이면 넘어간다.
   - 4줄이 끝나면 라운드를 마치고, 5라운드가 끝나면 회기를 마친다.
   - 기존 엔진은 "라운드 = 한 번 성공하면 끝"이라 줄 4개를 담을 수 있게 일반화해야 한다. 다른 게임의 결과는 바뀌면 안 된다(기존 테스트 유지).
4. **판정 규칙 `ONSET_FRICATION`(새 heuristic):**
   - 소리 시작의 마찰 구간(`onsetFricationMs`)이 기준 이상이고, 그 뒤 유성 구간(`voicedAfterFricationMs`)이 기준 이상이면 `success`다.
   - 기존 음질 게이트와 무발화·불확실 처리를 그대로 쓴다.
   - 시작값은 각각 60ms·80ms로 둔다(임시). 사용자의 실제 마이크 측정값(Claude가 D1~D2에 전달)으로 조정하고 `HEURISTIC_REGISTER.md`에 적는다.
   - 화면·문서에 '음향 근사'로 표시한다. 정확한 발음 판정이라고 쓰지 않는다.
5. **응답:** 발화마다 결과(`success`/`retry`/`uncertain`/`no_speech`)와 함께 다음 필드를 더한다.
   - 다음 항목, `roundIndex`(1~5), `itemIndexInRound`(1~4), `stripeIndex`(1~20), 남은 시도 수, `modelCue`(두두 시범 여부), `sessionComplete`
   - 필드 이름은 `src/api/**` 타입으로 먼저 정하고 이 문서 6절에 적는다. Claude는 그 타입으로 만든다.
6. **관찰:** 발화마다 기존 관찰 생성기로 `ClinicalObservation`을 만든다(활동 `daegu_crossing`, 라운드, 단서, 단계). 치료사 타임라인·목표별 추이(PR #10)에 그대로 나와야 한다. 점프 수·칭찬은 임상 자료가 아니다.
7. **보상 없음:** 이 게임은 재료·아이템·별을 주지 않는다. 재료 표에 넣지 않는다. 완료 요약은 시도 수 정도만 둔다.

### C. 빛의 마법 숨김과 치료사 화면 일관성

- `src/therapist/planning.ts`의 `ACTIVITY_LABELS`에 `daegu_crossing: '대구대 건너기'`를 넣는다(추이·타임라인에 영문 id가 보이지 않게).
- 치료사 활동 제안 선택지(`ActivityRecommendationPanel`)에서 빛의 마법을 뺀다. 서버의 활동 제안(`clinical/activity_recommendation.py`, 마찰음 지속 → 빛의 마법)과 회기 계획 기본 게임(`MAIN_GAME_BY_LEVEL`의 음소 단계)이 숨긴 게임을 추천하지 않게 바꾼다(예: 하늘 오르기). heuristic이므로 register를 갱신한다.
- 회기 계획 schema(`therapist_planning/**`, 동결)의 게임 목록에는 새 게임을 넣지 않는다. 데모는 계획이 게임을 구동하지 않는다(Phase 7 미착수). 이 한계를 문서에 적는다.
- 빛의 마법의 게임 id·과거 기록·치료사 기록 보기는 지우지 않는다.

### D. 시연용 DEMO 계정·데이터

- DEMO 아동 1명: 목표 /ㅅ/, 음절 단계, 별명(칭찬 "역시 ○○야"에 쓰임, 예: '두두친구'). 기존 seed와 섞이지 않게 한다.
- 담당 치료사 DEMO 계정.
- 리허설용 초기화 스크립트: DEMO DB에서 그 아동의 오늘 대화·회기만 지운다. 실제 DB에서는 실행을 거부한다.

### E. 검사와 PR

- 실행할 검사:
  - 백엔드 전체 pytest
  - `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build`
  - 새 DEMO DB에서 `smoke_api.py`
  - `git diff --check`, `npm.cmd audit`
- 새 테스트에 넣을 것:
  - 전환 신호(10회+2분, 5분, 무발화)
  - 새 게임 진행(줄·시도·불확실 처리·완료)
  - 판정 규칙의 경계값
  - 관찰 생성
  - 다른 게임 회귀
- 실행하지 못한 검사는 '미실행'으로 적는다. 실제 마이크·실기기는 사용자·Claude 측정 결과를 인용만 한다.
- PR: `codex/demo-server` → `claude/dudu-followup`. 설명은 한국어로 쓰고, 동결 변경 승인 요청을 따로 적는다.

### Claude 클라이언트가 이미 하는 것 (2026-10-05 구현, 서버가 맞출 것)

- **대화:** `src/child/hoyaChatController.ts`의 `ChatReply`에 `nextActivity?: string | null`을 넣었다. 아동 응답에 이 필드가 오면 두두가 그 말을 하는 동안 아래 '대구대 건너기' 버튼이 빛난다. Codex는 `src/api/hoyaChat.ts`를 고치지 않아도 된다(타입이 controller에서 온다).
- **시작 마찰 측정:** '대구대 건너기'는 공용 `MicUtterancePipeline` 대신 `src/game/crossing/onsetPipeline.ts`를 쓴다.
  - 공용 경로는 발화 감지 기준(잡음+12dB)이 마찰음 기준(+6dB)보다 높아, 조용히 낸 /ㅅ/의 시작 마찰이 0으로 남는다(테스트로 재현).
  - 새 경로는 감지 직전의 연속 마찰(최대 0.4초)을 되살려 `onsetFricationMs`·`voicedAfterFricationMs`를 채운다.
  - 서버 규칙은 이 값을 그대로 받는다.
- **놓침:** 기다리는 동안 말이 없으면 소리 없는 요약(`activeMs: 0`, `source: microphone`. DEMO면 `keyboard`)을 보낸다. 서버는 `no_speech`로 처리하면 된다(시도 미소모, 같은 줄 3번이면 넘어감).
- **DEMO 입력:** 누르고 말하기로 보낸다. 요약은 `source: 'keyboard'`, `durationMs`=누른 시간, `onsetFricationMs: 150`, `voicedAfterFricationMs`=누른 시간−150이다. 다른 게임처럼 DEMO로 표시하고 임상 근거에서 빼야 한다.
- **결과 읽기:** 응답에 `result` 필드가 있으면 그것을 쓴다. 없으면 기존 사건 이름으로 읽는다(`TARGET_SUCCESS`→success, `TARGET_RETRY`→retry, `NO_SPEECH`→no_speech, 나머지→uncertain). 줄 번호(`stripeIndex`)가 없으면 화면이 센다. 필드 이름이 바뀌면 `src/game/crossing/crossingJudge.ts` 한 곳만 고친다.
- **완료:** 마지막 줄 뒤 `/api/play/sessions/{id}/complete`를 부른다(임대 토큰 헤더 포함, 다른 V2 게임과 같음).
- **현재 상태:** 서버가 `daegu_crossing`을 모르면 활동 시작이 422다. 화면은 "서버에 아직 대구대 건너기가 준비되지 않았어요"라고 표시한다.

## 4. 지킬 원칙

- 게임 점수(점프·칭찬)는 임상 자료가 아니다.
- `NO_SPEECH`·`UNCERTAIN`은 실패가 아니다(분모 제외, 아동 화면에 실패 연출 없음).
- 자동 판정은 근사이며, 치료사가 확인·교정한다(append-only).
- 아동 화면에는 근거·점수·정확도를 보내지 않는다(이번에 더하는 `nextActivity`만 예외).
- 새 의존성·외부 서비스·유료 기능을 쓰지 않는다. 음성 원본을 저장하지 않는다.
- 설명·커밋 본문·문서는 한국어로 쓴다.

## 5. 일정 (Claude와 맞춤)

| 날 | Codex |
|---|---|
| D1 10/5 | 이 문서 검토, A·B 설계와 API 필드 이름 확정(6절), 동결 변경 승인 요청서 초안 |
| D2 10/6 | A(대본·전환 신호)와 B(새 게임 서버) 구현·테스트. **정오까지 API 필드를 확정해 Claude가 화면을 붙일 수 있게** |
| D3 10/7 | C(치료사 이름표·빛의 마법 숨김), 판정 기준값 반영(측정 결과 받은 뒤) |
| D4 10/8 | D(DEMO 계정·초기화), 통합 회귀 검사 |
| D5 10/9 | PR 정리, 리허설 지원 |

## 6. API 약속 (2026-10-05 확정)

Claude는 `src/api/hoyaChat.ts`와 `src/api/daeguCrossing.ts`를 기준으로 연결한다. 기존 네 게임과 아이 쪽 `GameKind` 타입은 이 계약 커밋에서 변경하지 않는다.

| 대상 | 확정 필드·의미 |
|---|---|
| 대화 턴 200 | 기존 `status, turnIndex, clientRequestId, text, nextTurnIndex, sessionComplete` 유지. `nextActivity: "daegu_crossing" \| null`만 추가 |
| 대화 202 | 기존 처리 중 응답 유지. 완료한 요청 재전송은 저장한 같은 문구·전환 값을 반환 |
| 활동 시작 | `POST /api/activities`, 요청 `{game:"daegu_crossing", mode:"real"\|"demo"}`. 응답 타입 `DaeguCrossingStart` |
| 시작·재개 응답 | `sessionId, game, mode, heroName, rounds, currentRound, firstItem, nextAttemptIndex`와 아래 진행 필드. 재개 경로의 `leaseToken, completedRounds` 보존 |
| 진행 필드 | `roundIndex` 1~5, `itemIndexInRound` 1~4, `stripeIndex` 1~20, `triesLeft` 0~3, `modelCue` boolean, `sessionComplete` boolean |
| 발화 요청 | 기존 `POST /api/activities/{sessionId}/utterances`. `roundIndex, itemId, attemptIndex, transcript, acoustic, recognizer, attack:"basic"`. lease가 있으면 `X-Activity-Lease` 헤더 |
| 발화 응답 | 타입 `DaeguCrossingResponse`: `result: "success"\|"retry"\|"uncertain"\|"no_speech"`, `events, nextItem, nextAttemptIndex, currentRound`와 진행 필드 |
| 항목 | 타입 `DaeguCrossingItem`: `itemId, displayText, level, game:"daegu_crossing", pictureKey` |
| 라운드 | 타입 `DaeguCrossingRound`: `index, id, childTitle, childPrompt`. 임상 메타는 아동 응답에 포함하지 않음 |

- 진행 번호·남은 시도·시범 여부는 **응답 후 표시할 다음 항목** 기준이다. `result`는 방금 제출한 항목의 음향 근사 결과다.
- 최초 값은 1/1/1, `triesLeft=3`, `nextAttemptIndex=1`이다. 새 항목에서는 시도 번호와 남은 시도를 초기화한다.
- 같은 항목에서 `nextAttemptIndex`는 수락한 제출마다 증가한다. `uncertain/no_speech`의 제출 번호도 증가하지만 `triesLeft`는 줄지 않는다. 서버가 반환한 번호를 그대로 다음 요청에 사용한다.
- 완료 시 번호는 5/4/20에 머무르고 `nextItem=null, currentRound=null, triesLeft=0, modelCue=false, sessionComplete=true`다.
- 음질 보류·무발화는 평가 시도를 소모하지 않는다. 같은 줄에서 연속 세 번이면 중립적으로 다음 줄로 이동한다.
- 점수·정확도·판정 근거는 새 아동 응답에 넣지 않는다. 관찰은 기존 치료사 API에서만 검토한다.
- 대화 전환은 목표 관찰 시도 10회 이상+서버 시간 120초 이상, 또는 300초 이상이다. 연속 무발화 3회에는 쉬운 질문을 먼저 하고, 그 다음에도 무발화면 전환한다.
- 마이크 측정 전 판정 임시값은 onset 60ms·이후 유성 80ms다. 측정하지 않은 값을 검증됐다고 표시하지 않는다.

## 7. 승인 로그

- 2026-10-05 사용자: “앞으로 작업 다 승인할테니까 승인 절차 하자라고 하기전까지 알아서 진행해 대신 승인에 관한 로그 짧게 남겨놔”.
- 적용: 데모 서버·치료사 범위 및 대화 동결 계약의 추가 필드/전환 변경을 별도 재확인 없이 구현·검사·기능 브랜치 PR까지 진행한다. 변경 파일·계약 영향·회귀 결과는 PR에 기록한다. 명시된 파일 분담, 새 의존성/외부 서비스 금지, main push·병합 금지는 유지한다.
