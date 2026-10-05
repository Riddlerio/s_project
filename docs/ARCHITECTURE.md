# Speech Hero 구조

## 시스템 흐름

브라우저의 아동 화면은 DEMO 스크립트 또는 Web Speech API로 인식한 텍스트와 발성 시간 특성을 서버에 전달합니다. 서버는 발화를 분석하고 훈련 정책을 적용해 게임 이벤트를 반환합니다. 치료사 화면은 세션 지표, 분석과 결정 근거를 조회합니다.

```mermaid
flowchart LR
  A[아동 게임] --> B[음성 입력과 VAD]
  B --> C[FastAPI Play API]
  C --> D[정규화·G2P·정렬·점수]
  D --> E[훈련 정책]
  E --> F[게임 이벤트]
  F --> A
  E --> G[SQLite 세션·결정·분석]
  G --> H[진행 지표·추천]
  H --> I[치료사 대시보드]
  I --> J[목표 버전·피드백 규칙]
  J --> C
```

## 주요 데이터

`TrainingGoal`은 목표 버전을 보존합니다. `TrainingPlan`은 세션의 슬롯과 순서를 고정하고, `TrainingSession.runtime_state`는 현재 항목·시도·단계·XP를 기록합니다. `Utterance`와 `SpeechAnalysis`는 입력과 근사 분석을 분리합니다. `TrainingDecision`은 판단 근거를, `GameEvent`는 게임 동작과 치료사 설명을 저장합니다. `ProgressMetric`과 `AIRecommendation`은 세션 완료 후 생성됩니다.

## 정책과 이벤트

같은 항목을 재시도하며 단서와 힌트를 제공하고, 연속 목표 재시도 후 낮은 단계에서 연습합니다. 강화 단계에서 연속 성공하면 원래 항목으로 복귀합니다. Magic Beam은 발성 시간만으로 성공을 판단하며 몬스터 타워의 연속 성공·재시도 횟수에는 영향을 주지 않습니다. 각 계획 슬롯의 ID는 고유합니다.

아동 게임 이벤트는 성공·재시도·단계 변화·보상을 표현합니다. 치료사 로그는 같은 이벤트를 한국어 관찰 문장으로 설명합니다. AI 점수와 대치 유형은 아동 응답에 포함하지 않습니다.

## 5일 데모 추가(2026-10-05)

- **대화 → 게임 전환:** 대화 턴 응답에 `nextActivity`(`"daegu_crossing"` 또는 `null`) 하나만 더했습니다. 서버가 목표 낱말 시도(`TARGET_OBSERVED`, 정확한 발음 아님) 횟수와 서버 시간으로 정하고(`hoya/transitions.py`), 아동 화면은 이 값이 오면 아래 '대구대 건너기' 버튼을 빛냅니다.
- **대구대 건너기(`daegu_crossing`):** 브라우저의 `OnsetPipeline`이 소리 시작의 마찰 구간과 그 뒤 유성 구간을 재서 기존 음향 요약 필드로 보냅니다. 서버 `ONSET_FRICATION` 규칙이 success·retry·uncertain·no_speech를 정하고(`games/evaluation.py`), 진행(5라운드 × 2줄, 줄당 3번)은 `games/crossing.py`가 맡습니다. 두두의 점프·'딱 맞았어!' 같은 효과는 서버 결과를 따라가는 화면 연출이며 저장하지 않습니다. 관찰은 기존 관찰 생성기로 치료사 타임라인에 들어갑니다.
- **두두 목소리:** `KoreanTts`는 말의 모든 문장이 `shared/dudu_voice_lines.json`에 있으면 음성 파일을 재생하고, 아니면 브라우저 `speechSynthesis`로 말합니다. 두 경우 모두 두두가 말하는 동안 마이크 입력을 막고, 끝난 뒤 300ms를 기다려 다시 엽니다.

- **리듬과 치료사 박자 설정:** 건너기를 시작할 때 서버가 그 아동의 설정을 회기 상태에 `rhythm: {startBpm, allowFaster}` 스냅숏으로 남기고, 시작·재개 응답에 넣습니다.
  - 설정 API는 `GET/PUT /api/therapist/children/{child_id}/game-settings`입니다(시작 박자 76~100·기본 84, 빨라지기 기본 켬, 감사 기록 `GAME_SETTINGS_UPDATE`).
  - 화면은 값이 없으면 84/켬을 씁니다. 치료사 회기 응답의 `crossingSummary`는 그 회기의 스냅숏만 보여 줍니다.

### 대구대 건너기·대화 전환 API 약속 (2026-10-05 확정)

Claude는 `src/api/hoyaChat.ts`와 `src/api/daeguCrossing.ts`를 기준으로 연결한다. 기존 네 게임과 아이 쪽 `GameKind` 타입은 이 계약 커밋에서 변경하지 않는다.

| 대상 | 확정 필드·의미 |
|---|---|
| 대화 턴 200 | 기존 `status, turnIndex, clientRequestId, text, nextTurnIndex, sessionComplete` 유지. `nextActivity: "daegu_crossing" \| null`만 추가 |
| 대화 202 | 기존 처리 중 응답 유지. 완료한 요청 재전송은 저장한 같은 문구·전환 값을 반환 |
| 활동 시작 | `POST /api/activities`, 요청 `{game:"daegu_crossing", mode:"real"\|"demo"}`. 응답 타입 `DaeguCrossingStart` |
| 시작·재개 응답 | `sessionId, game, mode, heroName, rounds, currentRound, firstItem, nextAttemptIndex`와 아래 진행 필드. 재개 타입은 `DaeguCrossingSnapshot`. 완료 상태에서는 `firstItem/currentRound=null`. 재개 경로의 `leaseToken, completedRounds` 보존 |
| 진행 필드 | `roundIndex` 1~5, `itemIndexInRound` 1~2, `stripeIndex` 1~10, `triesLeft` 0~3, `modelCue` boolean, `sessionComplete` boolean |
| 발화 요청 | 기존 `POST /api/activities/{sessionId}/utterances`. `roundIndex, itemId, attemptIndex, transcript, acoustic, recognizer, attack:"basic"`. lease가 있으면 `X-Activity-Lease` 헤더 |
| 발화 응답 | 타입 `DaeguCrossingResponse`: `result: "success"\|"retry"\|"uncertain"\|"no_speech"`, `events, nextItem, nextAttemptIndex, currentRound`와 진행 필드 |
| 항목 | 타입 `DaeguCrossingItem`: `itemId, displayText, level, game:"daegu_crossing", pictureKey` |
| 라운드 | 타입 `DaeguCrossingRound`: `index, id, childTitle, childPrompt`. 임상 메타는 아동 응답에 포함하지 않음 |

- 진행 번호·남은 시도·시범 여부는 **응답 후 표시할 다음 항목** 기준이다. `result`는 방금 제출한 항목의 음향 근사 결과다.
- 최초 값은 1/1/1, `triesLeft=3`, `nextAttemptIndex=1`이다. 새 항목에서는 시도 번호와 남은 시도를 초기화한다.
- 같은 항목에서 `nextAttemptIndex`는 수락한 제출마다 증가한다. `uncertain/no_speech`의 제출 번호도 증가하지만 `triesLeft`는 줄지 않는다. 서버가 반환한 번호를 그대로 다음 요청에 사용한다.
- 완료 시 번호는 5/2/10에 머무르고 `nextItem=null, currentRound=null, triesLeft=0, modelCue=false, sessionComplete=true`다.
- 음질 보류·무발화는 평가 시도를 소모하지 않는다. 같은 줄에서 연속 세 번이면 중립적으로 다음 줄로 이동한다.
- 점수·정확도·판정 근거는 새 아동 응답에 넣지 않는다. 관찰은 기존 치료사 API에서만 검토한다.
- 대화 전환은 목표 관찰 시도 10회 이상+서버 시간 120초 이상, 또는 300초 이상이다. 연속 무발화 3회에는 쉬운 질문을 먼저 하고, 그 다음에도 무발화면 전환한다.
- 판정 기준(2026-10-05 실측 반영, `docs/handoff/MIC_MEASUREMENT_2026-10-05.md`): 시작 마찰 70ms·이후 유성 80ms 이상이면 success. 잡음보다 15dB 미만이면 uncertain. 성인 1명 PC 마이크 측정값이며 임상 검증이 아니다.

## 결정 사항과 경계

- 아동 화면은 발화가 조작 수단입니다. DEMO 모드의 `Space`는 발성 시간 입력 대체이며 화면에 표시됩니다.
- 세션 중 정책은 기존 목표 범위에서 조정합니다. 목표 자체는 치료사 결정으로만 새 버전을 만듭니다.
- 추천은 자동 적용되지 않습니다. 치료사가 수락하거나 사유를 기록해 거절합니다.
- 원본 음성은 저장하지 않습니다. 텍스트는 설정한 보존 기간 이후 시작 시 비웁니다.
- 실제 음성 모드는 Web Speech API에 의존합니다. 임상 진단이나 실시간 음향 진단은 범위 밖입니다.

상세 구현 범위와 남은 검증 항목은 `README.md`에 기록했습니다.
