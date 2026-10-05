# Speech Hero

## AI Adaptive Speech Training Game Platform



현재 repository를 분석한 뒤, 공모전에서 실제 시연 가능한 **Speech Hero MVP**를 설계하라.



이 프로젝트의 핵심은 단순한 음성 인식 게임이나 GPT 기반 캐릭터 챗봇을 만드는 것이 아니다.



Speech Hero는 다음 3개의 원칙을 반드시 중심으로 설계한다.



\---



# 0. 가장 중요한 Product Principles



## Principle 1 — Speech is the Controller



아이의 실제 음성이 게임의 입력 장치가 된다.



아이의:



\- 발음

\- 음소 특성

\- 음성 지속시간

\- 음량

\- 반복 수행 결과

\- 반응 속도

\- 이전 세션 기록



등이 실제 게임 상태를 변화시켜야 한다.



즉:



Speech



→ AI Analysis



→ Game Event



→ Game Reaction



구조이다.



일반 GPT 챗봇처럼 대화만 하는 시스템이 되어서는 안 된다.



\---



# Principle 2 — Therapy Hidden Behind Play



아이는 자신이 "치료 프로그램"을 사용하고 있다는 느낌을 최대한 받지 않아야 한다.



아이에게 보이는 것은:



치료



검사



훈련



점수 평가



발음 오류



가 아니라:



모험



퀘스트



캐릭터



몬스터



마법



아이템



레벨



성장



보상



스토리



이어야 한다.



즉 시스템 내부적으로는 전문적인 발음·말소리 훈련이 수행되지만,



Child Experience에서는 이를 게임 경험으로 변환한다.



예:



내부 시스템:



/ㅅ/ 음소 반복 훈련 필요



아이 화면:



"바람 마법을 더 강하게 만들어보자!"



\---



내부 시스템:



발음 retry 필요



아이 화면:



"몬스터가 방패를 만들었어!

이번에는 '사\~' 마법을 충전해보자!"



\---



내부 시스템:



난이도 하향



아이 화면:



"새로운 스킬을 먼저 연습해볼까?"



\---



아이 화면에서 가능한 한 다음 표현을 사용하지 않는다.



\- 치료

\- 장애

\- 오류

\- 틀림

\- 발음 문제

\- 정확도 부족

\- 검사

\- 평가 실패



아이의 실패를 punishment로 만들지 않는다.



실패는 항상:



게임 이벤트



힌트



다른 공격 방식



캐릭터 도움



난이도 조정



새로운 시도



로 변환한다.



\---



# Principle 3 — Therapist ↔ AI Closed Loop



Speech Hero의 가장 중요한 전문적 차별점이다.



언어치료사와 AI는 일방향 관계가 아니다.



반드시 다음의 반복적인 상호작용 구조를 갖는다.



```text

Language Therapist

&#x20;       ↓

Training Goal / Clinical Guidance

&#x20;       ↓

AI Training Engine

&#x20;       ↓

Game / Character / Speech Tasks

&#x20;       ↓

Child Speech Interaction

&#x20;       ↓

Speech \& Behavior Data

&#x20;       ↓

AI Analysis

&#x20;       ↓

Progress / Pattern / Graph

&#x20;       ↓

Language Therapist

&#x20;       ↓

Goal Adjustment / Correction

&#x20;       ↓

AI Training Engine

&#x20;       ↓

다음 훈련

```



즉,



**Therapist influences AI**



그리고



**AI results influence Therapist**



그리고 그 결과가 다시 AI의 행동을 변화시키는 구조이다.



이 Closed Loop를 제품 Architecture의 핵심으로 설계하라.



\---



# 1. Product Definition



Speech Hero는:



**AI 기반 게임형 아동 발음·말소리 훈련 지원 시스템**



이다.



AI가 언어치료사를 대체하지 않는다.



역할:



Language Therapist

= Clinical Supervisor



AI

= Adaptive Training Engine



Game

= Child Interaction Interface



Character

= Training Companion



Speech Engine

= Speech Signal Analyzer



Dashboard

= Therapist Decision Support Interface



이다.



\---



# 2. 두 개의 서로 다른 UX를 설계한다



Speech Hero에는 완전히 다른 두 개의 사용자 경험이 존재해야 한다.



## Child Experience



아이에게는:



게임



캐릭터



모험



보상



스토리



만 보인다.



전문적인 치료 정보는 보여주지 않는다.



\---



## Therapist Experience



치료사에게는:



\- phoneme

\- articulation target

\- word position

\- training hierarchy

\- accuracy

\- retry

\- response pattern

\- session trend

\- AI recommendation

\- intervention history



등 전문적인 정보를 제공한다.



즉:



```text

Child UI

게임 언어



&#x20;       ↕



AI Translation Layer



&#x20;       ↕



Therapist UI

전문적인 훈련 언어

```



구조를 고려한다.



동일한 사건이 서로 다른 방식으로 표현될 수 있어야 한다.



예:



System:



TARGET\_RETRY



Child:



"몬스터가 방패를 사용했어!"



Therapist:



"Target /ㅅ/ initial position retry 발생"



\---



# 3. Therapist → AI Interaction



치료사는 AI에게 단순히 데이터를 보는 사용자가 아니다.



AI 행동에 영향을 주는 Clinical Supervisor이다.



치료사는 다음과 같은 정보를 설정할 수 있어야 한다.



## Training Goal



\- target phoneme

\- target sound

\- syllable

\- word

\- word position

\- difficulty

\- session duration

\- repetition target

\- preferred cue

\- excluded task

\- priority target



예:



```text

Target phoneme: /ㅅ/



Current level:

word



Position:

initial



Session:

10 minutes



Priority:

accuracy before speed

```



\---



치료사는 게임을 하나씩 직접 만들지 않는다.



AI가 치료사의 높은 수준 목표를 해석하여:



\- 사용할 게임

\- 사용할 단어

\- 단어 순서

\- difficulty

\- hint

\- repetition

\- transition

\- reward timing



등을 결정한다.



즉:



```text

Therapist Goal



&#x20;      ↓



AI Training Policy



&#x20;      ↓



Generated Training Session



&#x20;      ↓



Game

```



이다.



\---



# 4. Therapist Correction → AI Adaptation



AI의 판단이 항상 맞다고 가정하지 않는다.



치료사는 AI 분석을 수정할 수 있어야 한다.



예:



AI:



"사과 → /ㅅ/ 오류 가능"



Therapist:



"오류 아님"



또는:



"혀 위치 cue 필요"



또는:



"현재 단계에서는 허용"



같은 feedback을 줄 수 있다.



이 feedback을 TrainingDecision 또는 TherapistFeedback 형태로 저장한다.



예:



```text

AI Analysis



↓



Therapist Review



↓



Accept

Correct

Override



↓



Training Policy Update



↓



Future Session

```



MVP에서는 실제 machine learning 재학습까지 하지 않아도 된다.



대신:



rule



preference



training policy



session configuration



에 반영할 수 있는 구조를 만든다.



향후 therapist feedback을 모델 개선 데이터로 활용할 수 있도록 Data Model을 설계한다.



\---



# 5. AI → Therapist Interaction



AI는 단순히 raw 데이터만 보여주지 않는다.



치료사가 빠르게 이해할 수 있는 형태로 분석한다.



예:



이번 세션:



```text

총 발화: 32



성공: 23



retry: 9



hint: 5

```



이것보다 중요한 것은:



**어떤 패턴이 반복되었는가**



이다.



예:



```text

/ㅅ/ initial



사과   72

사자   64

소리   61



반복적인 initial /ㅅ/ 수행 저하 관찰

```



다만 이를 진단으로 표현하지 않는다.



예:



좋은 표현:



"이번 세션에서 /ㅅ/ 초성 목표의 재시도가 반복적으로 관찰됨"



나쁜 표현:



"아동은 /ㅅ/ 조음장애가 있음"



\---



# 6. Progress Visualization



Therapist Dashboard의 그래프는 핵심 기능이다.



단순 장식용 chart가 아니어야 한다.



치료사의 다음 결정을 돕는 정보를 제공해야 한다.



Claude는 어떤 그래프가 임상적으로 또는 훈련 관리 관점에서 유용할지 구체적으로 설계한다.



최소한 다음을 고려한다.



## Session Trend



X:



session/date



Y:



performance



\---



## Phoneme Trend



예:



/ㅅ/



/ㅈ/



/ㄹ/



각 target의 변화



\---



## Difficulty Progression



syllable



→ word



→ short sentence



변화



\---



## Success / Retry / Hint



시간에 따른 비율 변화



\---



## Target Word Performance



예:



사과



사자



소리



수박



\---



## Training History



치료사가 설정한 goal 변경과



아동 수행 변화



사이의 관계를 볼 수 있게 고려한다.



예:



```text

Session 1



/ㅅ/ word



↓



Therapist adjusts



↓



Session 2



/ㅅ/ syllable reinforcement



↓



performance ↑

```



즉 그래프는 단순히 "점수가 올라갔다"를 보여주는 것이 아니라:



**Therapist intervention → Child response**



관계를 보여주는 방향으로 설계한다.



\---



# 7. AI Recommendation for Therapist



세션이 끝나면 AI는 다음 훈련에 대한 recommendation을 생성할 수 있다.



예:



```text

Observation



/ㅅ/ initial 목표에서 retry 비율이 높음.



Possible next training:



1\. syllable 수준의 /사, 소, 수/ 강화



2\. 이후 word 수준으로 복귀



3\. 다음 세션에서 initial /ㅅ/ 유지

```



이것은 자동 결정이 아니다.



치료사는:



Accept



Modify



Reject



할 수 있다.



구조:



```text

AI Recommendation

&#x20;       ↓

Therapist Decision

&#x20;       ↓

Training Goal

&#x20;       ↓

Next AI Session

```



이 구조가 반드시 시스템 Architecture에 반영되어야 한다.



\---



# 8. Adaptive Training Loop



AI는 아이의 현재 세션뿐만 아니라 과거 history도 사용할 수 있게 설계한다.



예:



```text

Current utterance



\+



Current session



\+



Previous sessions



\+



Therapist goal



\+



Therapist feedback



↓



Training Policy



↓



Next task

```



Training Policy 입력 후보:



\- target phoneme

\- current difficulty

\- recent attempts

\- success streak

\- retry streak

\- hint count

\- previous session performance

\- therapist priority

\- therapist corrections

\- fatigue/session duration



등을 고려한다.



\---



# 9. Training Hierarchy



다음 훈련 hierarchy를 지원할 수 있도록 한다.



phoneme



↓



syllable



↓



word



↓



short sentence



↓



sentence



↓



spontaneous speech



MVP에서 최소한:



syllable



word



short sentence



를 구현 또는 설계한다.



\---



# 10. Adaptive Example



예:



치료사의 목표:



```text

Target:

/ㅅ/



Level:

word



Position:

initial

```



AI가 선택:



사과



사자



소리



\---



아이:



따과



따자



또리



\---



AI:



동일 target 관련 retry pattern 관찰



\---



Training Policy:



word



↓



syllable



\---



Game:



"몬스터의 방패를 깨기 위해 마법을 충전하자!"



\---



Target:



사



소



수



\---



성공



↓



다시:



사과



\---



세션 종료



↓



AI Summary



↓



Therapist Dashboard



↓



AI Recommendation



↓



Therapist Accept / Modify



↓



다음 세션



이 전체 흐름이 하나의 Closed Loop이다.



\---



# 11. Game 1 — Monster Tower



메인 게임이다.



State Machine:



INTRO



MISSION



SHOW\_TARGET



LISTENING



ANALYZING



SUCCESS / RETRY



HINT



ANIMATION



NEXT\_TARGET



COMPLETE



\---



성공:



TARGET\_SUCCESS



↓



character attack



↓



monster HP decrease



↓



reward



↓



next target



\---



Retry:



TARGET\_RETRY



↓



monster shield



↓



character cue



↓



adaptive training



↓



retry



\---



아이는 이것을 평가라고 느끼지 않아야 한다.



모든 AI 판단은 게임 Event로 변환된다.



\---



# 12. Game 2 — Magic Beam



Speech is the Controller 개념을 가장 명확하게 보여주는 게임이다.



아이:



스\~\~\~\~\~\~\~\~



↓



VOICE\_START



↓



BEAM\_ACTIVE



↓



VOICE\_CONTINUE



↓



beam 유지



↓



VOICE\_END



↓



beam 종료



사용:



\- microphone

\- VAD

\- RMS / volume

\- duration



을 고려한다.



음성 지속시간 자체가 직접 게임 행동을 제어한다.



\---



# 13. Speech Pipeline



다음 Architecture를 고려한다.



```text

Microphone



↓



Audio Capture



↓



VAD / Noise Processing



↓



Speech Recognition



↓



Korean Text Normalization



↓



Korean G2P



↓



Phoneme Representation



↓



Phoneme Alignment / Scoring



↓



Error Pattern Estimator



↓



Training Policy



↓



Game Event

```



일반 ASR만 가지고 발음 정확도를 판단하지 않는다.



Whisper 계열 모델이 잘못된 발음도 정상 단어로 보정할 가능성을 고려한다.



향후:



\- wav2vec2

\- HuBERT

\- XLS-R

\- CTC phoneme recognition

\- forced alignment

\- acoustic scoring



등을 넣을 수 있게 architecture를 분리한다.



\---



# 14. AI Architecture



다음 Interface들을 고려한다.



SpeechRecognizer



PhonemeAnalyzer



SpeechScorer



ErrorPatternAnalyzer



TrainingPolicy



TherapistFeedbackService



ProgressAnalyzer



RecommendationEngine



CharacterDialogueProvider



각 요소가 특정 AI 모델과 강하게 결합되지 않도록 한다.



\---



# 15. Game Event Schema



Speech AI와 Game Engine 사이에는 normalized event를 사용한다.



예:



TARGET\_SUCCESS



TARGET\_RETRY



VOICE\_START



VOICE\_CONTINUE



VOICE\_END



HINT\_REQUIRED



LEVEL\_UP



LEVEL\_DOWN



REWARD



SESSION\_COMPLETE



Game은 AI 내부 모델을 몰라도 된다.



\---



# 16. Character System



캐릭터는 단순 UI 장식이 아니다.



아이와 시스템 사이의 Interaction Layer이다.



역할:



\- greeting

\- story

\- mission

\- encouragement

\- hint

\- celebration

\- transition

\- goodbye



LLM을 사용할 경우 child-safe bounded dialogue를 적용한다.



LLM/API 장애 발생 시 scripted fallback으로 계속 진행 가능해야 한다.



\---



# 17. Engagement without Therapy Awareness



Claude는 아동이 반복 훈련을 지루해하지 않도록 Game Design도 설계한다.



예:



XP



level



badge



character item



monster collection



map progression



story chapter



magic ability



daily mission



등.



그러나 과도한 중독 유도나 punishment mechanic은 피한다.



목표는:



**반복 훈련을 반복 플레이로 변환하는 것**



이다.



\---



# 18. Therapist Dashboard



최소 다음 영역을 설계한다.



## Overview



\- active children

\- recent session

\- pending AI recommendations



## Child Profile



\- anonymized child ID

\- current goal

\- target phoneme

\- level

\- training history



## Session Detail



\- utterances

\- target

\- result

\- retries

\- hints

\- scores

\- duration



## Progress



\- session trend

\- target phoneme trend

\- difficulty progression

\- retry/hint trend



## AI Insight



\- repeated patterns

\- noteworthy changes

\- suggested next training



## Therapist Feedback



\- accept

\- modify

\- reject

\- manual correction

\- note



\---



# 19. Core Data Model



최소:



Child



Therapist



TrainingGoal



TrainingPlan



TrainingSession



Utterance



SpeechAnalysis



GameEvent



TrainingDecision



AIRecommendation



TherapistFeedback



ProgressMetric



를 고려한다.



중요한 연결:



```text

TrainingGoal

&#x20;   ↓

TrainingSession

&#x20;   ↓

Utterance

&#x20;   ↓

SpeechAnalysis

&#x20;   ↓

TrainingDecision

&#x20;   ↓

ProgressMetric

&#x20;   ↓

AIRecommendation

&#x20;   ↓

TherapistFeedback

&#x20;   ↓

TrainingGoal

```



이 관계를 명확하게 설계한다.



\---



# 20. History / Explainability



AI가 왜 다음 task를 선택했는지 추적 가능해야 한다.



예:



```text

Decision:



word → syllable



Reason:



last 3 attempts TARGET\_RETRY



Target:



/ㅅ/



Therapist priority:



accuracy



Previous session:



similar pattern

```



Therapist Dashboard에서 최소한 사람이 이해할 수 있는 형태로 보여줄 수 있도록 한다.



Black-box recommendation만 제공하지 않는다.



\---



# 21. Child Data Privacy



아동 음성 데이터임을 고려한다.



최소:



\- anonymized ID

\- raw audio 최소 저장

\- audio delete policy

\- guardian consent 확장

\- therapist authentication

\- access control

\- secrets separation

\- sensitive log minimization



을 architecture에 반영한다.



\---



# 22. Demo Modes



실제 공모전에서 시스템이 멈추지 않아야 한다.



REAL MODE



DEMO MODE



를 분리할 수 있게 설계한다.



REAL:



실제 microphone + 실제 speech pipeline



DEMO:



일부 AI analysis fallback 가능



그러나 demo/mock을 실제 AI라고 위장하지 않는다.



\---



# 23. Technology



현재 repository를 먼저 조사한다.



기본 후보:



Child:



React + TypeScript



Game:



Phaser 또는 Canvas



Audio:



Web Audio API



Therapist:



React



Backend:



FastAPI + Python



Database:



SQLite MVP



향후:



PostgreSQL



실시간 기능:



필요한 경우에만 WebSocket



Unreal Engine은 반드시 필요하지 않으면 사용하지 않는다.



\---



# 24. Repository Structure



현재 repository가 매우 초기 단계라면 다음과 같은 구조를 검토한다.



```text

apps/



&#x20; child-app/



&#x20; therapist-web/



&#x20; backend/



packages/



&#x20; shared-types/



&#x20; game-core/



&#x20; speech-core/



&#x20; training-engine/



&#x20; character-core/

```



그러나 architecture를 위해 architecture를 만들지 않는다.



MVP에서 더 단순한 구조가 적합하면 단순화한다.



\---



# 25. Claude Code의 역할



Claude는 바로 코드를 구현하지 않는다.



우선 현재 repository 전체를 분석한다.



반드시:



AGENTS.md



.agents/skills/



README



현재 source



git status



git history



dependencies



runtime environment



을 확인한다.



그 후 Codex가 바로 구현할 수 있는 수준의 상세 Architecture를 작성한다.



\---



# 26. Claude가 반드시 결정해야 하는 것



단순 아이디어 문서를 만들지 말고 다음을 실제 engineering decision 수준으로 결정한다.



1\. System Architecture



2\. Child App Architecture



3\. Therapist Dashboard Architecture



4\. Speech Pipeline



5\. Training Policy



6\. Therapist ↔ AI Closed Loop



7\. Database Schema



8\. API endpoints



9\. Game Event Schema



10\. Game State Machines



11\. Character Architecture



12\. Progress Metrics



13\. Graph specifications



14\. AI Recommendation structure



15\. Therapist feedback flow



16\. Demo fallback



17\. REAL / DEMO provider separation



18\. Repository structure



19\. implementation order



20\. testing strategy



21\. privacy design



22\. dataset strategy



23\. Unreal Engine necessity



24\. MVP / Phase 2 / Research-grade boundary



\---



# 27. 매우 중요한 MVP / Research 구분



Claude는 각 기능을 다음 세 단계로 명확하게 구분한다.



## MVP — 반드시 구현



공모전에서 실제 실행되는 기능.



## Phase 2



시간이 있다면 구현.



## Research-grade



실제 임상 적용 또는 연구 데이터가 필요한 기능.



예:



정밀한 phoneme diagnosis는 Research-grade일 수 있다.



그러나:



microphone



VAD



speech duration



game event



adaptive rule



therapist feedback



dashboard



graph



등은 MVP에서 실제 구현하는 방향을 우선 검토한다.



\---



# 28. Codex Handoff



Claude 설계 결과는 Codex가 별도 질문 없이 구현을 시작할 수 있을 정도로 구체적이어야 한다.



각 task에:



\- 목적

\- 파일

\- module

\- input

\- output

\- dependency

\- acceptance criteria

\- test



를 가능하면 명시한다.



예:



```text

TASK:



Magic Beam audio controller



Files:



...



Input:



Microphone PCM stream



Output:



VOICE\_START

VOICE\_CONTINUE

VOICE\_END



Acceptance:



voice starts → beam starts

voice stops → beam stops



Tests:



VAD state transition test

```



형태가 좋다.



\---



# 29. Codex Implementation Priority



Codex는 다음 순서를 기본으로 따른다.



1\. Project environment



2\. shared types / schemas



3\. DB schema



4\. backend API



5\. Child App shell



6\. microphone



7\. speech provider abstraction



8\. Monster Tower



9\. normalized events



10\. Magic Beam



11\. Training Policy



12\. Therapist Dashboard



13\. Graphs



14\. Therapist Feedback



15\. AI Recommendation



16\. Character interaction



17\. integration



18\. tests



19\. UI polish



20\. README



\---



# 30. Tests



최소한 다음을 검증한다.



Monster Tower state transitions



Magic Beam voice transitions



Training Policy decision



Therapist Feedback persistence



Training Goal → Session relation



Session → Dashboard aggregation



AI Recommendation → Therapist decision flow



frontend build



TypeScript typecheck



backend tests



API smoke test



\---



# 31. Git



main에 직접 push하지 않는다.



feature branch를 사용한다.



완료 후:



git diff



tests



README



commit



push



PR



순으로 진행한다.



\---



# 32. 최종 Demo Story



공모전 시연은 다음 흐름이 자연스럽게 연결되어야 한다.



## Step 1 — Therapist



치료사가 아동의 목표를 설정한다.



예:



/ㅅ/



word



initial



↓



AI가 오늘 훈련을 구성한다.



\---



## Step 2 — Child



아이는 치료 목표를 알 필요가 없다.



캐릭터:



"오늘 몬스터 타워를 올라가자!"



↓



Monster Tower



↓



아이 발화



↓



Speech AI



↓



Game Event



↓



게임 반응



↓



adaptive hint



↓



다음 목표



\---



## Step 3 — Speech Controller



Magic Beam



↓



아이:



스\~\~\~\~



↓



voice duration



↓



beam control



\---



## Step 4 — Session Analysis



세션 종료



↓



AI:



session pattern 분석



↓



Dashboard



↓



그래프



↓



AI Recommendation



\---



## Step 5 — Therapist Decision



치료사:



Accept / Modify / Reject



↓



Training Goal Update



↓



다음 세션의 AI 행동 변화



\---



이것이 Speech Hero의 핵심 Loop이다.



```text

Therapist

&#x20;   ↓

AI

&#x20;   ↓

Game

&#x20;   ↓

Child

&#x20;   ↓

Speech Data

&#x20;   ↓

AI Analysis

&#x20;   ↓

Graph + Recommendation

&#x20;   ↓

Therapist

&#x20;   ↓

AI

```



\---



# 최종 핵심 차별점



Speech Hero의 경쟁력은 단순히 AI가 들어갔다는 것이 아니다.



첫째,



**Speech is the Controller**



아이의 실제 음성이 게임을 직접 변화시킨다.



둘째,



**Therapy Hidden Behind Play**



아이에게는 치료가 아니라 하나의 게임과 모험으로 경험된다.



셋째,



**Therapist ↔ AI Closed Loop**



치료사의 전문적 지시가 AI 훈련에 영향을 주고,



아이의 실제 수행 데이터를 AI가 분석하여 그래프와 recommendation으로 치료사에게 다시 전달하며,



치료사의 판단이 다시 AI의 다음 훈련을 변화시킨다.



즉:



**Therapist → AI → Child → AI → Therapist**



라는 지속적인 상호작용 구조가 Speech Hero의 핵심 시스템이다.



Claude는 이 세 가지 원칙이 실제 System Architecture, Database, API, UI, Game Logic, AI Pipeline에 어떻게 반영되는지 구체적으로 설계하라.



단순한 컨셉 설명에서 끝내지 말고 Codex가 바로 구현할 수 있는 engineering specification을 작성하라.


# Interactive Design & Implementation Questions

Claude와 Codex는 중요한 제품·설계·구현 결정을 사용자의 의도를 임의로 추측해서 확정하지 않는다.

가능한 경우 AskUserQuestions 또는 이에 준하는 사용자 질문 기능을 사용한다.

단, 사소한 구현사항까지 계속 질문하지 않는다.

질문의 기본 기준은 다음과 같다.

> 사용자의 답변에 따라 Product, Architecture, UX, AI Behavior, Data, Privacy, MVP Scope 또는 실제 구현 결과가 의미 있게 달라지는가?

YES → 사용자에게 질문
NO → 에이전트가 합리적으로 결정

---

# 1. 공통 원칙

먼저 조사하고, 그다음 질문한다.

다음에서 답을 찾을 수 있다면 사용자에게 묻지 않는다.

- repository
- source code
- AGENTS.md
- SPEECH_HERO_TASK.md
- 기존 configuration
- Claude Engineering Plan
- 이전 사용자 결정사항

즉:

**Don't ask what you can discover.**

반대로 다음처럼 사용자가 직접 결정해야 하는 것은 임의로 확정하지 않는다.

- 제품 방향
- 아동 UX
- 치료사 workflow
- AI 자율성
- 개인정보
- 중요한 architecture
- 실제/데모 AI 범위

즉:

**Don't guess what the user should decide.**

---

# 2. Claude의 질문 역할

Claude는 주로 **제품 및 Architecture 설계 결정**을 질문한다.

예:

- 주요 아동 연령
- 훈련 대상 범위
- 아이에게 점수를 보여줄지
- 실패를 게임에서 어떻게 표현할지
- 캐릭터 역할과 대화 범위
- reward / progression 방식
- 치료사가 설정할 수 있는 목표 범위
- AI가 자동으로 바꿀 수 있는 훈련 범위
- AI Recommendation 승인 방식
- Therapist Accept / Modify / Reject 정책
- Dashboard에서 중요한 지표
- raw audio 저장 여부
- 개인정보 정책
- REAL AI / DEMO AI 범위
- 외부 API 사용 여부
- 공모전 Demo에서 반드시 보여줄 기능

Claude는 중요한 미결정 사항을 해결한 후 최종 Engineering Plan을 작성한다.

---

# 3. Codex의 질문 역할

Codex는 Claude가 확정한 결정을 다시 질문하지 않는다.

Codex는 주로 **실제 구현 중 새롭게 발견된 문제**를 질문한다.

예:

- Claude Plan과 실제 repository가 충돌함
- 구현 방법에 따라 architecture가 크게 달라짐
- 기존 코드를 대량 삭제하거나 변경해야 함
- 중요한 dependency/runtime 설치 필요
- 외부 API 또는 서비스 선택 필요
- 개인정보 관련 구현 결정 필요
- REAL AI 구현이 불가능하여 fallback 방식 결정 필요
- 중요한 기술 선택이 latency/cost/demo stability에 큰 영향을 줌

Codex는 작은 구현 세부사항은 스스로 결정한다.

예:

- 변수명
- 함수명
- 일반적인 파일명
- helper 함수
- CSS spacing
- lint/formatter
- import 정리
- 일반적인 error handling
- 단순 bug fix

---

# 4. 질문은 Batch로 묶는다

질문을 하나씩 반복하지 않는다.

서로 관련된 중요한 질문을 한 번에 묶는다.

권장:

Claude:
3~7개

Codex:
2~5개

예:

## Child Experience Decisions

1. 아이에게 발음 점수를 직접 보여줄 것인가?

A. 숫자로 보여줌
B. 숫자는 숨기고 게임 결과로 표현
C. 일부만 표시

Recommended: B

Reason:
아이가 치료·평가를 받는 느낌을 줄이고 게임 경험을 유지하기 좋음.

---

2. 실패 후 진행 방식은?

A. 즉시 동일 단어 반복
B. 쉬운 단계로 내려갔다가 다시 시도
C. 다음 문제로 이동

Recommended: B

Reason:
Adaptive Training 구조를 가장 잘 보여줄 수 있음.

---

# 5. 좋은 질문 형식

중요한 질문은 가능하면 다음 정보를 포함한다.

- 왜 이 결정이 필요한지
- 어떤 기능에 영향을 주는지
- 선택지
- 각 선택지의 핵심 장단점
- 추천안
- 추천 이유

Claude와 Codex는 단순히:

"어떤 것을 사용할까요?"

라고 질문하지 않는다.

예:

## Raw Audio Storage

A. 저장하지 않음
- Privacy 유리
- 재분석 어려움

B. 일정 기간 저장
- 재분석 가능
- 개인정보 관리 필요

C. 치료사가 선택
- 유연함
- 구현 복잡도 증가

Recommended:
A for MVP

사용자는 A / B / C 또는 별도 의견을 선택할 수 있다.

---

# 6. 질문 우선순위

Claude는 가능하면 다음 순서로 중요한 결정을 해결한다.

Product / Target User

↓

Therapist ↔ AI Interaction

↓

Child Game Experience

↓

Speech AI

↓

Data / Privacy

↓

Dashboard / Graph

↓

Demo / Deployment

앞의 결정이 뒤 설계에 영향을 준다면 먼저 질문한다.

---

# 7. Therapist ↔ AI 관련 질문은 특히 중요하다

Speech Hero의 핵심 기능이므로 다음 결정은 임의로 넘기지 않는다.

예:

### AI Training Control

A. AI가 자동으로 다음 훈련 변경

B. 세션 중에는 AI가 adaptive하게 조정하고, 장기 목표 변경은 치료사 승인

C. 모든 변경을 치료사가 승인

MVP 추천:
B

---

### AI Recommendation

A. 자동 적용

B. 치료사에게 추천 후 Accept / Modify / Reject

C. 분석만 표시

MVP 추천:
B

---

치료사의 지시가 AI에 영향을 주고,

AI가 분석한 결과와 그래프가 다시 치료사의 결정에 영향을 주며,

그 결정이 다음 AI 훈련에 반영되는 Closed Loop를 유지해야 한다.

---

# 8. 중요한 결정은 기록한다

Claude가 사용자에게 질문하여 확정한 내용은 Engineering Plan의 Decision Log에 기록한다.

예:

## Confirmed Decisions

- Target age: ...
- Child score visibility: ...
- Therapist control level: ...
- AI recommendation policy: ...
- Raw audio policy: ...
- Character interaction: ...
- Demo scope: ...
- REAL / DEMO AI boundary: ...

Codex는 이 기록을 먼저 읽는다.

Codex 단계에서 새롭게 결정된 중요한 사항도 기록한다.

---

# 9. 결정 우선순위

충돌이 발생하면 기본적으로 다음 순서를 따른다.

1. 최신 사용자 결정
2. SPEECH_HERO_TASK.md의 핵심 Product Principles
3. Claude Engineering Plan
4. 기존 Repository
5. Agent 자체 판단

큰 Architecture 변경이 필요한 경우 Codex가 임의로 바꾸지 않고 질문한다.

---

# 10. 질문할 수 없는 경우

사용자 결정 없이는 진행할 수 없는 중요한 사항이 있는데 질문 기능을 사용할 수 없다면:

BLOCKED_BY_USER_DECISION

으로 표시한다.

그리고 다음을 남긴다.

- 결정이 필요한 내용
- 필요한 이유
- 선택지
- 추천안

단, 해당 결정과 관계없는 구현은 계속 진행한다.

---

# 11. 최종 Interaction Flow

전체 개발 흐름은 다음을 목표로 한다.

User Requirement

↓

Claude Repository Analysis

↓

Claude Question Batch

↓

User Decisions

↓

Claude Engineering Plan

↓

Gate

↓

Codex Implementation

↓

필요한 경우 Codex Question Batch

↓

User Decisions

↓

Codex Implementation Continue

↓

Test / Build / Integration

↓

README

↓

Commit / Push / PR

Claude는 **설계 파트너**,

Codex는 **구현 파트너**로 역할을 분리한다.

두 에이전트 모두 이미 확정된 질문을 반복하지 않는다.

---

# 핵심 규칙

**중요한 결정은 질문한다.**

**찾아보면 알 수 있는 것은 질문하지 않는다.**

**작은 구현사항은 에이전트가 결정한다.**

**질문은 여러 개를 Batch로 묶는다.**

**선택지 + 장단점 + 추천 이유를 함께 제시한다.**

**Claude의 사용자 결정은 Codex가 그대로 이어받는다.**
