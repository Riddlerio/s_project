\# Speech Hero — Therapist Workflow + AI Planning Foundation

\# Claude Code + Codex 협업 구현 최종 프롬프트



Repository:

Riddlerio/s\_project



==================================================

0\. 목표

==================================================



이번 작업의 목적은 Speech Hero에 기능을 많이 추가하는 것이 아니다.



현재 흩어져 있는:



\- 여러 아동 관리

\- TrainingGoal

\- 과거 TrainingSession

\- ClinicalObservation

\- ClinicalVerification

\- ProgressMetric

\- AI/Activity Recommendation



을 언어치료사의 실제 업무 흐름에 맞게 하나의 구조로 정리한다.



최종 치료사 흐름:



담당 아동 목록

→ 아동 선택

→ 현재 치료 목표 확인

→ 이전 회기 및 검증된 근거 확인

→ 다음 회기 계획

→ 치료사 승인

→ 이후 결과 검토

→ 다음 계획



이번 PR은 여기까지 완성한다.



아동 Hoya → Game → Hoya 자동 실행은

다음 Phase로 남긴다.





==================================================

1\. 먼저 현재 Git 상태 확인

==================================================



구현 전에 반드시 remote/main과 open PR을 확인한다.



현재 참고 상태:



\- Speech Hero clinical/evidence reference:

&#x20; docs/references/SPEECH\_HERO\_EVIDENCE\_SOURCES.md

\- 해당 문서를 반드시 설계 근거로 읽는다.



기존 pronunciation research PR과 production 변경을 섞지 않는다.



새 branch:



feature/therapist-workflow-ai-foundation



금지:



git reset --hard

git clean -fd

git add .

.env stage

기존 사용자 변경 덮어쓰기

자동 merge





==================================================

2\. 구현 전 READ-ONLY 분석

==================================================



Claude Code는 다음 subagent를 병렬 실행하되

모두 READ-ONLY로 사용한다.



A. Repo Architect



확인:



Therapist

Child

TrainingGoal

TrainingPlan

TrainingSession

ClinicalObservation

ClinicalVerification

ProgressMetric

AIRecommendation

ActivityRecommendation

HoyaChatSession

HoyaChatTurn



그리고:



Overview.tsx

ChildDetail.tsx

SessionDetail.tsx



현재 관계와 문제점을 정리한다.





B. Database Reviewer



다음만 본다.



\- child ↔ therapist ownership

\- cross-child isolation

\- TrainingGoal version

\- TrainingPlan 현재 역할

\- collection\_json 사용처

\- 임상 데이터 저장 위치

\- Hoya 데이터와 임상 데이터 경계

\- SQLite 구조

\- 향후 PostgreSQL 이전 가능성



결과를:



KEEP

CHANGE

DO\_NOT\_TOUCH



세 그룹으로 정리한다.





C. Clinical Workflow Reviewer



다음 파일을 우선 읽는다.



docs/references/SPEECH\_HERO\_EVIDENCE\_SOURCES.md



특히:



\- ASHA Speech Sound Disorders

\- ASHA Documentation

\- 충남대학교 언어치료센터 실제 workflow

\- 대구대학교 언어치료학과 Case Conference

\- 대구대학교 2019 연구

\- Allen 2013

\- Digital Game systematic review

\- 한국 아동 SSD ASR 연구



를 기준으로 제품 흐름이 과장되지 않았는지 확인한다.





D. Therapist UX Reviewer



현재 치료사 화면이:



목표

추천

그래프

규칙

세션

관찰



을 한 화면에 과도하게 보여주고 있는지 분석한다.



언어치료사의 실제 task 순서:



누구를 볼 것인가

→ 현재 목표는 무엇인가

→ 이전 회기에서 어땠는가

→ 다음에는 무엇을 할 것인가

→ 결과를 어떻게 해석할 것인가



에 맞게 화면을 재구성한다.





E. Security Reviewer



확인:



\- IDOR

\- cross-child leakage

\- DEMO contamination

\- unverified evidence 사용

\- therapist note prompt injection

\- raw audio persistence

\- transcript retention



Subagent는 코드를 수정하지 않는다.



Main Claude가 결과를 통합해서

하나의 짧은 implementation plan을 만든 뒤 구현한다.





==================================================

3\. 제품의 임상 범위

==================================================



Speech Hero는:



진단 시스템

발음장애 자동 판정 시스템

자동 치료 결정 시스템



이 아니다.



위 참고 자료의 실제 치료 흐름처럼:



초기 평가/진단

→ 치료사 목표 설정

→ 중재

→ 진행 평가

→ 다음 계획



중에서 Speech Hero는:



치료사가 목표를 정한 이후의

훈련 수행·기록·정리·계획 보조



영역을 담당한다.



AI의 역할:



정리

요약

근거 기반 제안

자연어 표현



최종 결정:



언어치료사





==================================================

4\. 치료사 UI 정보구조

==================================================



기존 ChildDetail 하나에 기능을 더 쌓지 않는다.



구조를 다음 4영역으로 정리한다.



THERAPIST HOME

↓

CHILD WORKSPACE



1\. 요약

2\. 치료 목표

3\. 다음 회기

4\. 경과 · 기록





\--------------------------------------------------

1\. 요약

\--------------------------------------------------



표시:



아동 코드/별칭

연령대

현재 목표

최근 실제 회기

검토할 observation 수

다음 Session Plan 상태



복잡한 AI score나 모든 graph를 첫 화면에 두지 않는다.





\--------------------------------------------------

2\. 치료 목표

\--------------------------------------------------



기존 TrainingGoal 사용.



TrainingGoal 의미:



"현재 이 아동이 장기적으로 훈련 중인 목표"



표시/수정:



target phoneme

position

level

min level

priority targets

excluded words

preferred cue

target trials

session duration



기존 version 구조 유지.





\--------------------------------------------------

3\. 다음 회기

\--------------------------------------------------



이번 기능의 핵심.



다음 순서:



최근 검증 근거

↓

시스템 요약

↓

다음 회기 제안

↓

치료사가 수정

↓

승인





치료사는 긴 prompt를 작성하지 않는다.



Structured Form:



목표 음소

위치

시작 단계

목표 단계

세션 시간

목표 시도 횟수

허용 cue

우선 단어

제외 단어

대화 주제

활동 순서



자유 입력:



치료사 메모



정도만 둔다.





\--------------------------------------------------

4\. 경과 · 기록

\--------------------------------------------------



구분:



Goal Progress

Recent Sessions

Pending Clinical Review

Previous Session Plans



기존 AI Recommendation / Therapist Rules는

고급 정보 영역으로 이동한다.



한 화면에 모든 것을 노출하지 않는다.





==================================================

5\. DB 의미를 명확하게 분리

==================================================



기존:



TrainingGoal

TrainingPlan

TrainingSession



의 의미를 변경하지 않는다.





TrainingGoal

=

장기/현재 치료 목표





새 모델:



TherapistSessionPlan

=

치료사가 승인한 "다음 한 회기 계획"





기존 TrainingPlan

=

실제 게임 실행 시 서버가 생성하는 execution plan





향후:



TherapyRun

=

Hoya + 여러 게임을 하나의 실제 회기로 묶는 상위 실행 객체





관계:



TrainingGoal

&#x20;     ↓

TherapistSessionPlan

&#x20;     ↓

\[future]

TherapyRun

&#x20;     ↓

TrainingPlan / TrainingSession / HoyaChatSession





이번 PR에서는 TherapyRun을 구현하지 않는다.





==================================================

6\. TherapistSessionPlan 모델

==================================================



새 table을 추가하는 방향을 우선 사용한다.



기존 table을 억지로 변경하지 않는다.



예:



TherapistSessionPlan



id

child\_id FK

therapist\_id FK

goal\_id FK



parent\_plan\_id nullable

revision



status



target\_phoneme

word\_position

start\_level

target\_level



duration\_min

repetition\_target

preferred\_cue



priority\_targets JSON

excluded\_words JSON



conversation\_theme

therapist\_note



evidence\_snapshot JSON

recommendation\_snapshot JSON



created\_at

updated\_at

approved\_at

cancelled\_at





status:



DRAFT

APPROVED

SUPERSEDED

CANCELLED





ACTIVE / COMPLETED는 넣지 않는다.



그것은 향후 TherapyRun 상태다.





==================================================

7\. Plan Step

==================================================



활동 순서를 명확하게 관리한다.



TherapistSessionPlanStep



id

plan\_id

step\_order

step\_type

activity

target\_level

parameters JSON





step\_type:



CONVERSATION

GAME

PRACTICE





activity:



hoya\_conversation

magic\_beam

sky\_climb

monster\_adventure

conversation\_quest





이 구조는 향후 LangGraph orchestration이

그대로 읽을 수 있게 한다.





==================================================

8\. 승인 상태와 변경 규칙

==================================================



DRAFT

→ 수정 가능



APPROVED

→ immutable



승인 후 변경해야 하면:



APPROVED

↓

clone

↓

new DRAFT revision

↓

approve

↓

old plan SUPERSEDED





이유:



나중에 당시 어떤 계획으로 회기가 진행됐는지

재현 가능해야 한다.





==================================================

9\. 분석 엔진과 Summary AI를 분리

==================================================



중요 원칙:



"서버가 계산하고 AI가 설명한다."





Python / SQL에서 계산:



\- attempts

\- evaluable trials

\- retry rate

\- cue count

\- level별 경향

\- verified observation 수

\- uncertain

\- no speech



LLM에게 숫자 계산을 맡기지 않는다.





예:



DB

↓

Evidence Filter

↓

Deterministic Metrics

↓

Structured Context

↓

Summary AI

↓

Therapist





Summary AI 역할:



\- 치료사가 읽기 쉽게 요약

\- 관찰된 사실과 제안을 구분

\- 다음 회기 후보를 설명



금지:



\- 진단

\- 새로운 임상 사실 생성

\- 숫자 재계산

\- 치료법 임의 생성

\- 자동 goal 수정





==================================================

10\. AI orchestration 설계

==================================================



이번 Phase에서는 LangGraph 기반

Therapist Planning Graph의 뼈대만 설계한다.



필요 이상으로 agent를 늘리지 않는다.



권장 Graph:



START

↓

LoadPlanningContext

↓

FilterVerifiedEvidence

↓

CalculateMetrics

↓

GeneratePlanProposal

↓

GenerateSummary

↓

ValidateOutput

↓

END





중요:



CalculateMetrics

=

Python deterministic





GeneratePlanProposal

=

우선 deterministic rules





GenerateSummary

=

LLM API





ValidateOutput

=

Python schema + safety rules





현재 필요 없는:



멀티에이전트 토론

self-reflection loop

critic loop

여러 LLM 비교

recursive retry

tool-calling agent



는 만들지 않는다.



토큰 낭비와 구조 복잡도를 막는다.





==================================================

11\. LangChain / LangGraph 사용 원칙

==================================================



LangGraph:

AI 흐름과 state 관리



LangChain:

필요한 기능만 사용



예:



structured output

prompt template

retriever



LangChain을 전체 backend abstraction으로 만들지 않는다.



단순 API 호출이 더 명확하면

OpenAI SDK를 그대로 사용한다.





==================================================

12\. RAG

==================================================



현재 별도 학습 데이터셋으로

Summary AI를 fine-tuning하지 않는다.



필요한 지식은:



docs/references/SPEECH\_HERO\_EVIDENCE\_SOURCES.md



및 내부 임상 근거 문서에서 가져온다.



단,

이번 Phase에서는 대규모 vector DB를 새로 구축하지 않는다.



우선순위:



1\. 프로젝트 내부 curated clinical summary

2\. 필요한 핵심 근거만 context로 전달

3\. 향후 문서가 많아질 때 vector DB 도입





즉 지금은:



Small curated context



를 우선한다.



토큰을 절약한다.





==================================================

13\. Summary AI 입력

==================================================



LLM에 전체 DB row를 보내지 않는다.



최소 구조화 context만 만든다.



예:



{

&#x20; currentGoal,

&#x20; recentVerifiedSummary,

&#x20; levelSummary,

&#x20; cueSummary,

&#x20; recentTrend,

&#x20; evidenceAvailability

}





포함 가능:



현재 goal

최근 CONFIRMED/CORRECTED 관찰

계산 완료된 metric

관련 근거 코드





보내지 않음:



아동 이름

child id

play code

account 정보

raw audio

다른 아동 데이터

전체 transcript history





==================================================

14\. Summary AI 출력

==================================================



structured output:



{

&#x20; "observationSummary": "...",

&#x20; "evidencePoints": \[

&#x20;   "..."

&#x20; ],

&#x20; "nextSessionSuggestion": "...",

&#x20; "limitations": \[

&#x20;   "..."

&#x20; ]

}





다음 표현 금지:



diagnosis

AI 확정

치료 효과 보장

정확한 발음 판정





예:



좋음:

"최근 확인된 단어 수준 관찰에서는 독립 산출이 비교적 안정적으로 나타났습니다."



금지:

"아동의 /ㅅ/ 장애가 개선되었습니다."





==================================================

15\. Evidence Filter

==================================================



임상 추천 근거:



REAL

\+

CONFIRMED 또는 CORRECTED





제외:



DEMO

seed

PENDING

REJECTED





UNCERTAIN

NO\_SPEECH

POOR\_AUDIO



는 실패로 변환하지 않는다.





Hoya:



TARGET\_OBSERVED

≠

CORRECT\_PRONUNCIATION



유지.





==================================================

16\. Recommendation

==================================================



처음부터 LLM이 치료 계획을 만들지 않는다.



기존:



TrainingGoal

ClinicalObservation

ClinicalVerification

ProgressMetric

ActivityRecommendation



을 이용하여

deterministic proposal을 만든다.





자료가 부족하면:



INSUFFICIENT\_DATA





출력 예:



현재 목표 유지

\+

추가 관찰 필요





LLM은 그 내용을 치료사가 읽기 좋은 문장으로만 바꾼다.





==================================================

17\. collection\_json

==================================================



새 임상 정보 저장 금지.



collection\_json은 계속:



badge

monsterCards

hoyaTaps

게임 보상



등 비임상 상태에 사용한다.



SessionPlan

clinical evidence

recommendation



을 넣지 않는다.





==================================================

18\. Claude Code / Codex 역할

==================================================



같은 파일을 동시에 수정하지 않는다.





\--------------------

Claude Code

\--------------------



역할:



Architecture Lead

Clinical Workflow

LangGraph contract

Frontend

Integration





소유:



src/therapist/\*\*

src/api/therapist.ts

src/App.tsx



AI orchestration spec



docs/therapist-workflow.md





Claude subagents:



Repo Reviewer

Clinical Reviewer

UX Reviewer

Security Reviewer



READ ONLY





\--------------------

Codex

\--------------------



역할:



DB

Backend API

Evidence filter

Deterministic metrics

Backend integrity tests





소유:



backend/app/models.py



backend/app/therapist\_planning/\*\*



backend/tests/test\_therapist\_planning.py



main router 연결에 필요한 최소 변경





Codex는 frontend 수정 금지.



Claude는 Codex backend 구현을 임의로 다시 쓰지 않는다.





==================================================

19\. API Contract 먼저 고정

==================================================



구현 전에 Claude가 contract를 만든다.



예:



GET

/api/children/{id}/planning-context



POST

/api/children/{id}/session-plan-proposal



GET

/api/children/{id}/session-plans



POST

/api/children/{id}/session-plans



GET

/api/session-plans/{id}



PATCH

/api/session-plans/{id}



POST

/api/session-plans/{id}/approve



POST

/api/session-plans/{id}/cancel



POST

/api/session-plans/{id}/clone





schema도 먼저 확정한다.



그 이후 endpoint 이름을

각 agent가 임의 변경하지 않는다.





==================================================

20\. 충돌 방지 진행 순서

==================================================



1\. 최신 main 확인



2\. Claude READ-ONLY subagent 분석



3\. architecture/API contract 작성



4\. contract freeze



5\. Codex backend/DB 구현



6\. Codex backend tests



7\. Claude frontend 구현



8\. Integration



9\. Codex READ-ONLY adversarial review



10\. blocker 수정



11\. 전체 regression



12\. PR





가능하면 별도 worktree를 사용한다.





==================================================

21\. 토큰과 규모 제한

==================================================



이 작업에서 중요하다.



DO NOT:



\- 수십 개 agent 생성

\- 같은 파일 반복 전체 읽기

\- 같은 논문 다시 인터넷 검색

\- 이미 repo에 있는 근거를 매번 외부 검색

\- 대규모 RAG 구축

\- vector DB 추가

\- 새로운 ML 모델 추가

\- 불필요한 abstraction layer 추가

\- Hoya 전체 재작성

\- 게임 전체 재작성





우선:



docs/references/SPEECH\_HERO\_EVIDENCE\_SOURCES.md



를 근거 source of truth로 사용한다.



추가 검색은

중대한 임상/기술 결정에서

현재 문서가 부족할 때만 한다.





==================================================

22\. 이번 Phase에서 수정하지 않을 영역

==================================================



원칙적으로 수정하지 않는다:



src/child/\*\*

backend/app/hoya/\*\*

backend/app/games/\*\*

backend/app/training/plan\_generator.py

research/\*\*





이번 Phase의 종료점:



APPROVED TherapistSessionPlan





아동 실행 연결은 다음 Phase.





==================================================

23\. 다음 Phase 설계만 문서화

==================================================



향후:



APPROVED TherapistSessionPlan

↓

TherapyRun

↓

LangGraph Session Orchestrator

↓

Hoya

↓

Game

↓

Hoya

↓

Game

↓

Run Summary

↓

Therapist Review





LangGraph가:



current\_step

next\_step

activity

status



를 관리한다.





LLM은:



대화 문장

transition

요약



만 담당한다.





LLM이:



게임 선택

goal 변경

임상 성공 판정



을 하지 않는다.





==================================================

24\. 여러 아동 관리 테스트

==================================================



한 치료사:



Child A

B

C

D

E





각 아동마다:



goal

history

observation

plan



을 다르게 만든다.





검증:



A 데이터가 B 추천에 섞이지 않음.



A plan을 B가 조회하지 못함.



Therapist B가

Therapist A의 child 접근 불가.



다른 아동 note / target word가

LLM context에 섞이지 않음.





==================================================

25\. 필수 backend test

==================================================



\- draft 생성

\- draft 수정

\- approve

\- approved mutation reject

\- clone revision

\- cancel

\- goal 변경 후 approved snapshot 유지

\- verified REAL evidence only

\- DEMO 제외

\- UNCERTAIN 실패 제외

\- NO\_SPEECH 실패 제외

\- cross-child isolation

\- IDOR

\- audit log

\- clinical data not in collection\_json





==================================================

26\. 필수 frontend test

==================================================



\- 5명 caseload 표시

\- child 선택

\- 4영역 workspace

\- session plan draft

\- proposal form prefill

\- 수정

\- approve

\- approved read-only

\- clone

\- insufficient data UI

\- pending clinical review 표시





==================================================

27\. DB 원칙

==================================================



현재:



SQLAlchemy

\+

SQLite



유지.





새 table 추가 방식 우선.



기존 DB destructive migration 금지.





이번에:



PostgreSQL migration

Alembic 도입



하지 않는다.





향후 production에서:



PostgreSQL

\+

Alembic



도입 예정이라고 문서화만 한다.





==================================================

28\. Regression

==================================================



반드시 실행:



backend\\.venv\\Scripts\\python.exe -m pytest backend -q



npm.cmd test



npm.cmd run typecheck



npm.cmd run build



backend\\.venv\\Scripts\\python.exe backend\\scripts\\smoke\_api.py



git diff --check



npm audit





실행하지 않은 것은

PASS라고 보고하지 않는다.





==================================================

29\. 최종 READ-ONLY Review

==================================================



Codex에게 최종 diff를 READ-ONLY로 검토시킨다.



찾을 것:



cross-child leakage

IDOR

approved plan mutation

DEMO contamination

UNCERTAIN failure conversion

LLM numerical reasoning

LLM clinical decision

prompt injection

raw audio persistence

collection\_json misuse

API mismatch

unnecessary architecture complexity

duplicate logic





blocker만 수정한다.



사소한 스타일 refactor로 scope를 키우지 않는다.





==================================================

30\. 이번 PR에서 구현하지 않는다

==================================================



\- Hoya→Game 자동 navigation

\- TherapyRun

\- child-side approved plan UI

\- 발음 ML 모델

\- Azure

\- prosody

\- raw audio upload

\- full SOAP/EHR

\- 부모 portal

\- PostgreSQL migration

\- Alembic

\- large vector DB

\- custom fine-tuning





==================================================

31\. Git / PR

==================================================



관련 파일만 stage.



git add . 금지.





commit 예:



docs: define therapist workflow and AI boundaries



feat: add therapist session planning backend



test: cover session planning integrity



feat: restructure therapist workspace





PR title:



feat: establish therapist-centered planning workflow





자동 merge 금지.





==================================================

32\. 최종 보고

==================================================



1\. CURRENT GIT STATE

2\. EXISTING ARCHITECTURE

3\. CLINICAL BASIS

4\. DATABASE REVIEW

5\. FINAL THERAPIST FLOW

6\. AI / LANGGRAPH DESIGN

7\. CLAUDE / CODEX DIVISION

8\. CONFLICT CHECK

9\. BACKEND CHANGES

10\. FRONTEND CHANGES

11\. SECURITY / PRIVACY

12\. TEST RESULTS

13\. NOT TESTED

14\. CHANGED FILES

15\. COMMITS

16\. PR URL

17\. NEXT PHASE





마지막:



THERAPIST\_WORKFLOW\_READY



또는



THERAPIST\_WORKFLOW\_BLOCKED





==================================================

33\. 최종 설계 원칙

==================================================



FastAPI / SQLAlchemy / DB

=

사실과 상태를 관리한다.



Deterministic Python Logic

=

계산과 임상 규칙을 처리한다.



LangGraph

=

AI workflow와 state 흐름을 관리한다.



LLM API

=

요약, 설명, 자연어 대화를 담당한다.



LangChain

=

structured output / retriever 등

필요한 기능만 사용한다.





가장 중요한 원칙:



"서버가 계산하고 AI가 설명한다."



"AI가 치료를 결정하지 않는다."



"치료사가 프롬프트 엔지니어가 되지 않는다."



"불확실한 음성은 실패가 아니다."



"한 아동의 데이터는 다른 아동에게 절대 영향을 주지 않는다."



"TrainingGoal, SessionPlan, Execution Plan은 서로 다른 개념이다."



"이번 Phase에서는 치료사 workflow를 먼저 완성하고

아동 orchestration은 다음 단계에서 연결한다."



"복잡도를 높이는 것보다

치료사의 실제 업무 흐름이 명확해지는 것을 우선한다."

