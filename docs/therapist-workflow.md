# 치료사 업무 흐름과 AI 경계

이 문서는 치료사 회기 계획 기능의 설계 기준이다. 임상 근거는 `docs/references/SPEECH_HERO_EVIDENCE_SOURCES.md`를 따른다.
아래 API 계약은 고정본이다. 이름을 바꾸려면 이 문서부터 고친다.

## 1. 제품 범위

치료 과정은 초기 평가·진단 → 치료사 목표 설정 → 중재 → 진행 평가 → 다음 계획 순서로 진행된다(CNU-FLOW, ASHA-SSD).
Speech Hero가 맡는 부분은 치료사가 목표를 정한 뒤의 훈련 수행, 기록, 정리, 계획 보조뿐이다.

- Speech Hero는 진단 시스템이 아니다. 발음장애를 자동으로 판정하지 않고, 치료를 자동으로 결정하지 않는다.
- AI는 정리하고 요약하며, 근거를 바탕으로 제안하고 자연어로 설명한다. 최종 결정은 언어치료사가 한다.
- 원칙: **서버가 계산하고 AI가 설명한다.** 숫자는 Python이 계산하고, LLM은 계산된 값을 문장으로 옮기기만 한다.

## 2. 치료사 흐름

```
담당 아동 목록 → 아동 선택 → 현재 목표 확인 → 이전 회기와 검증된 근거 확인
→ 다음 회기 계획 → 치료사 승인 → (다음 Phase) 실행 → 결과 검토 → 다음 계획
```

아동 작업 공간(`/therapist/children/:id`)은 탭 네 개로 나눈다.

| 탭 | 내용 |
|---|---|
| 요약 | 아동 코드·별칭, 연령대, 현재 목표, 최근 실제 회기, 검토할 관찰 수, 다음 회기 계획 상태 |
| 치료 목표 | TrainingGoal 조회와 수정(버전 구조 유지), 목표 이력 |
| 다음 회기 | 최근 검증 근거 → 시스템 요약 → 다음 회기 제안 → 치료사 수정 → 승인 |
| 경과 · 기록 | 목표 경과, 최근 회기, 검토 대기 관찰, 이전 회기 계획. 기존 AI 추천과 치료사 규칙은 접힌 "고급 정보" 안에 둔다 |

치료사는 긴 프롬프트를 쓰지 않는다. 다음 회기는 구조화된 form으로 작성하고, 자유 입력은 치료사 메모 하나만 둔다.

## 3. 데이터 개념 분리

| 개념 | 모델 | 의미 |
|---|---|---|
| 치료 목표 | `TrainingGoal`(기존) | 아동이 장기적으로 훈련 중인 현재 목표. 버전마다 행 하나 |
| 회기 계획 | `TherapistSessionPlan`(신규) | 치료사가 승인한 "다음 한 회기" 계획 |
| 실행 계획 | `TrainingPlan`(기존) | 게임 실행 때 서버가 만드는 execution plan |
| 실제 회기 | `TherapyRun`(다음 Phase) | 호야와 여러 게임을 하나의 회기로 묶는 상위 실행 객체 |

```
TrainingGoal → TherapistSessionPlan → [future] TherapyRun → TrainingPlan / TrainingSession / HoyaChatSession
```

- `collection_json`에는 배지, 몬스터 카드, hoyaTaps, 게임 보상 같은 비임상 상태만 둔다. 회기 계획, 임상 근거, 추천은 넣지 않는다.
- DB는 SQLAlchemy와 SQLite를 유지한다. 새 table은 `create_all`로 추가하며, 기존 table은 바꾸지 않는다.
- 운영 단계에서는 PostgreSQL과 Alembic을 도입할 예정이다. 이번 PR 범위는 아니다.

### TherapistSessionPlan 상태

```
DRAFT ──approve──▶ APPROVED ──clone──▶ 새 DRAFT(revision+1) ──approve──▶ APPROVED
  │                    │                                     (이전 APPROVED는 SUPERSEDED)
  └──cancel──▶ CANCELLED ◀──cancel──┘
```

- DRAFT만 수정할 수 있다. APPROVED는 바꿀 수 없으며, 고치려면 clone해서 새 revision을 만든다.
- 한 아동에게 APPROVED 계획은 하나만 둔다. 새 계획을 승인하면 기존 APPROVED는 SUPERSEDED가 된다.
- 승인 시점에 목표 스냅숏, 근거 지표, 결정적 제안을 `evidence_snapshot`과 `recommendation_snapshot`에 고정한다. 나중에 목표가 바뀌어도 당시 계획은 그대로 재현된다.
- 초안의 목표가 이미 새 버전으로 바뀌었다면 승인하지 않는다(409). 계획을 새로 작성해야 한다.
- ACTIVE와 COMPLETED는 두지 않는다. 이 두 상태는 다음 Phase의 TherapyRun 상태다.

### Plan Step

| step_type | 허용 activity |
|---|---|
| CONVERSATION | hoya_conversation |
| GAME | magic_beam, sky_climb, monster_adventure, conversation_quest |
| PRACTICE | magic_beam, sky_climb, monster_adventure, conversation_quest |

`parameters`는 `{trials?: 1-60, durationMin?: 1-15}`만 허용한다. 임의의 JSON은 받지 않는다.

## 4. 근거 필터와 결정적 지표

임상 근거로 쓰는 자료는 다음 조건을 모두 만족해야 한다.

- 세션이 REAL(`mode == "real"`)이고 seed가 아니다.
- 가장 최근 치료사 검증이 confirm 또는 correct다.
- correct인 경우에는 치료사가 교정한 결과를 쓴다.

DEMO, seed, PENDING, REJECTED 자료는 제외하고 건수만 따로 보여 준다.
UNCERTAIN, NO_SPEECH, POOR_AUDIO는 실패로 바꾸지 않는다. 성공률 분모(`evaluableN`)에서 빼고 따로 센다. 녹음 불량(POOR) 관찰은 결과가 success나 retry여도 평가 가능 시도에 넣지 않는다(`poorAudioVerifiedN`).
호야의 `TARGET_OBSERVED`는 대화 속에서 목표 음소가 나왔다는 뜻일 뿐, 정확한 발음이라는 뜻이 아니다. 성공으로 세지 않는다.

- 계산 범위: 이 아동의 최근 실제 회기 5개.
- 계산하는 값: 관찰 수, 검증 수, 검토 대기 수, 평가 가능 시도, 성공, 재시도율, 불확실, 무발화, 목표 관찰, cue별 건수, 독립성별 건수, 단계별 경향.
- 자료가 없으면 0이 아니라 `null`로 둔다.
- 평가 가능 시도가 5개 미만이면 결과는 `INSUFFICIENT_DATA`다. 이때 제안은 "현재 목표 유지 + 추가 관찰 필요"다.

## 5. AI 흐름: Therapist Planning Graph

LangGraph `StateGraph`로 구성하고, 노드 여섯 개가 한 방향으로 실행된다. 루프, 토론, 비평가(critic), 재시도, tool-calling은 두지 않는다.

```
START → LoadPlanningContext → FilterVerifiedEvidence → CalculateMetrics
      → GeneratePlanProposal → GenerateSummary → ValidateOutput → END
```

| 노드 | 방식 |
|---|---|
| LoadPlanningContext | SQLAlchemy로 아동 한 명의 목표·회기·관찰만 읽음 |
| FilterVerifiedEvidence | Python 결정 규칙(4절) |
| CalculateMetrics | Python 결정 계산 |
| GeneratePlanProposal | Python 결정 규칙. 기존 `propose_activity`의 활동 제안을 재사용 |
| GenerateSummary | LLM(OpenAI SDK). 설정이 없거나 실패하면 결정적 템플릿 |
| ValidateOutput | Pydantic schema와 금지 표현 검사. 통과하지 못하면 템플릿으로 대체 |

LangChain은 쓰지 않는다. 단순 API 호출은 OpenAI SDK가 더 명확하기 때문이다.

LangSmith는 선택 사항인 모니터링 도구로만 쓴다. 제품 로직은 LangSmith에 의존하지 않고, 기본값은 꺼짐이다.
운영자가 `LANGSMITH_TRACING=true`와 `LANGSMITH_API_KEY`를 설정했을 때만 LangGraph 실행 추적이 전송된다.
LLM 입력은 이미 비식별 구조화 context이며, 켜기 전에 기관의 개인정보 정책을 확인한다.

### Summary AI 입력(최소 context)

```json
{"currentGoal": {...}, "recentVerifiedSummary": {...}, "levelSummary": [...], "cueSummary": {...},
 "recentTrend": [...], "evidenceAvailability": {...}, "proposal": {...}, "clinicalContext": ["[ASHA-SSD] ..."]}
```

- 보내지 않는 정보: 아동 이름, child id, play code, 계정 정보, 원음성, 다른 아동의 자료, transcript, 치료사 메모, 우선 단어, 제외 단어.
- 임상 근거는 정리된 짧은 문장 7개(`backend/app/therapist_planning/clinical_context.py`)를 system 지시에 넣는다. vector DB는 쓰지 않는다.

### Summary AI 출력

```json
{"observationSummary": "...", "evidencePoints": ["..."], "nextSessionSuggestion": "...", "limitations": ["..."]}
```

다음 표현이 나오면 출력을 폐기하고 템플릿을 쓴다: 진단, 장애가 개선, 치료 효과 보장, 정확한 발음 판정, AI 확정 등.
입력에 없는 숫자가 있거나, 비율(%)이 서버가 계산한 비율 값과 다를 때도 같다. `nextSessionSuggestion`은 LLM 문장을 쓰지 않고 항상 서버 규칙의 설명 문장으로 바꾼다. LLM이 새 활동이나 치료법을 제안하지 못하게 하기 위해서다.
활동 제안(`propose_activity`)은 그 근거 관찰이 모두 화면에 보인 범위(최근 실제 회기 5개) 안에 있을 때만 쓴다.

설정 키(`backend/.env`)는 다음과 같다. 셋 중 하나라도 없으면 LLM을 호출하지 않는다.

- `THERAPIST_SUMMARY_ENABLED`(기본 false)
- `THERAPIST_SUMMARY_MODEL`
- `OPENAI_API_KEY`(호야와 공유)

## 6. API 계약(고정)

모든 경로는 치료사 쿠키 인증을 쓰고, GET이 아니면 `X-CSRF-Token`이 필요하다. 다른 치료사의 아동이나 계획을 요청하면 404를 반환하고 `ACCESS_DENIED` 감사 기록을 남긴다. 요청과 응답은 camelCase를 쓴다.

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/children/{id}/planning-context` | 요약 탭 자료: 목표, 근거 지표, 검토 대기 수, 최근 실제 회기, 최신 계획 상태 |
| POST | `/api/children/{id}/session-plan-proposal` | 그래프 실행. `{status, proposal, summary, metrics, evidence}`. 저장하지 않음 |
| GET | `/api/children/{id}/session-plans` | 계획 목록(최신순, step 포함) |
| POST | `/api/children/{id}/session-plans` | SessionPlanInput으로 DRAFT 생성 |
| GET | `/api/session-plans/{planId}` | 계획 한 건 |
| PATCH | `/api/session-plans/{planId}` | DRAFT form 전체를 교체. DRAFT가 아니면 409 |
| POST | `/api/session-plans/{planId}/approve` | DRAFT를 APPROVED로 바꾸고 스냅숏 고정. 기존 APPROVED는 SUPERSEDED |
| POST | `/api/session-plans/{planId}/cancel` | DRAFT나 APPROVED를 CANCELLED로. 그 밖의 상태는 409 |
| POST | `/api/session-plans/{planId}/clone` | DRAFT가 아닌 계획을 복제해 새 DRAFT(revision+1, parentPlanId)를 만듦 |

### SessionPlanInput

| 필드 | 타입 | 제약 |
|---|---|---|
| targetPhoneme | `ㅅ`, `ㅈ`, `ㄹ` | |
| wordPosition | `initial`, `medial`, `final` | |
| startLevel | `phoneme`, `syllable`, `word`, `short_sentence` | targetLevel 이하 |
| targetLevel | `syllable`, `word`, `short_sentence` | |
| durationMin | 5, 10, 15 | |
| repetitionTarget | 정수 | 10–60 |
| preferredCue | `none`, `visual_mouth`, `auditory_model`, `tactile_description` | |
| priorityTargets | 문자열 목록 | 최대 20개, 각 20자 |
| excludedWords | 문자열 목록 | 최대 20개, 각 20자 |
| conversationTheme | 문자열 | 최대 100자 |
| therapistNote | 문자열 | 최대 500자 |
| steps | StepInput 목록 | 1–8개 |

StepInput은 `{stepType, activity, targetLevel?, parameters?}` 형태다.

### SessionPlan 응답

```
id, childId, goalId, goalVersion, parentPlanId, revision, status,
targetPhoneme, wordPosition, startLevel, targetLevel, durationMin, repetitionTarget, preferredCue,
priorityTargets, excludedWords, conversationTheme, therapistNote,
steps[{id, stepOrder, stepType, activity, targetLevel, parameters}],
evidenceSnapshot, recommendationSnapshot, createdAt, updatedAt, approvedAt, cancelledAt
```

### 감사 기록

다음 동작마다 `AuditEvent`를 남긴다. `resource_id`는 plan id다.

- `SESSION_PLAN_CREATED`
- `SESSION_PLAN_UPDATED`
- `SESSION_PLAN_APPROVED`
- `SESSION_PLAN_SUPERSEDED`
- `SESSION_PLAN_CANCELLED`
- `SESSION_PLAN_CLONED`

## 7. 다음 Phase(설계만)

```
APPROVED TherapistSessionPlan → TherapyRun → LangGraph Session Orchestrator
→ 호야 → 게임 → 호야 → 게임 → 회기 요약 → 치료사 검토
```

- LangGraph가 `current_step`, `next_step`, `activity`, `status`를 관리한다. 순서는 승인된 plan step이 정한다.
- LLM은 대화 문장, 전환 멘트, 요약만 맡는다. 게임 선택, 목표 변경, 임상 성공 판정은 하지 않는다.
- 아동 화면에 승인된 계획을 보여 주는 UI와 호야→게임 자동 이동은 다음 Phase에서 구현한다.
