# ============================================================

# SPEECH HERO V2

# ORCA MASTER ORCHESTRATION TASK

#

# Claude Code  : Product / AI / Security / UX Architecture

# Codex        : Implementation / Testing / Integration / Git

# Claude Review: Architecture / Security / UX / Competition Review

# ============================================================

# ============================================================

# 0. MISSION

# ============================================================

기존 Speech Hero MVP를 버리지 말고 Speech Hero V2로 발전시킨다.

Speech Hero V2의 핵심 제품 정의:

"사용자가 귀여운 3D 호랑이 캐릭터와 자연스럽게 대화하고,

캐릭터와 게임을 진행하는 과정에서 말소리 훈련이 이루어지며,

AI가 발음 특징을 분석하고,

치료사가 목표·어드바이스·게임을 조정할 수 있는

Human-in-the-loop AI 말소리 훈련 플랫폼"

이번 작업은 단순 UI 리뉴얼이 아니다.

핵심 축:

1. 3D Tiger Conversational Companion

2. Audio-based Pronunciation Intelligence

3. Adaptive High-quality Games

4. Therapist Interactive Loop

5. Secure Student / Therapist / Admin Platform

6. Modern Kids-first Frontend

7. Privacy / RBAC / Security

8. Competition-ready Portfolio Quality

# ============================================================

# 1. ROLE CONTRACT

# ============================================================

ORCA가 현재 role을 제공한다.

--------------------------

PLAN ROLE — CLAUDE

--------------------------

Claude는 먼저 repository 전체를 조사한다.

읽을 것:

[AGENTS.md](http://AGENTS.md)

[README.md](http://README.md)

SPEECH\_HERO\_[TASK.md](http://TASK.md)

package.json

vite.config.ts

src/\*\*

backend/\*\*

docs/\*\*

tests/\*\*

.gitignore

그리고 Git 상태와 remote branch 구조도 확인한다.

Plan 단계에서는 production code를 직접 구현하지 않는다.

해야 할 일:

- 현재 MVP 구조 파악

- 재사용 / 수정 / 폐기 / 신규 부분 분류

- Speech Hero V2 architecture 설계

- Security architecture 설계

- Pronunciation AI roadmap 설계

- Character / Conversation architecture 설계

- Game architecture 설계

- Therapist workflow 설계

- Database/API migration 설계

- UI design system 설계

- 단계별 implementation plan 작성

- acceptance criteria 작성

- 위험 요소 작성

애매한 사항은 합리적으로 판단하되,

제품 방향을 크게 바꿀 결정만 사용자 Gate에서 명확하게 제시한다.

계획은 Codex가 그대로 구현할 수 있을 정도로 구체적이어야 한다.

--------------------------

EXECUTE ROLE — CODEX

--------------------------

Codex는 Claude의 plan artifact를 Source of Truth로 사용한다.

단:

사용자의 이 Master Task 요구사항

&gt;

Claude Plan

&gt;

현재 repository conventions

순서로 우선순위를 둔다.

Plan과 현재 repo가 충돌하거나

새로운 중요한 architecture decision이 발생하면:

QUESTION:

프로토콜을 이용해 Claude Planner에게 묻는다.

임의로 핵심 제품 방향을 변경하지 않는다.

Codex는:

- 실제 코드 작성

- migration

- frontend

- backend

- security

- tests

- docs

- build

- smoke test

- Git

- push

- PR 준비

까지 수행한다.

--------------------------

REVIEW ROLE — CLAUDE

--------------------------

Review 단계에서는 구현 결과를 전체적으로 검토한다.

검토:

- Claude plan과 일치하는가

- 실제 요구사항이 연결되어 있는가

- 단순 mock이 실제 AI처럼 보이지 않는가

- 보안 취약점이 없는가

- 권한 우회가 가능한가

- 아동 데이터 보호가 되는가

- 게임 품질이 개선됐는가

- 3D 캐릭터가 실제 중심 UX인가

- 치료사 loop가 실제 연결되는가

- 테스트가 의미 있는가

- 공모전 시연 가능한가

Blocker가 있으면:

CHANGES\_REQUIRED

를 명시하고 정확한 파일/이유/수정 요구사항을 작성한다.

모든 핵심 acceptance gate를 만족한 경우에만:

READY\_FOR\_FINAL\_VALIDATION

을 선언한다.

# ============================================================

# 2. CURRENT VERIFIED REPOSITORY CONTEXT

# ============================================================

작업 시작 시 반드시 live Git 상태를 다시 확인한다.

현재 알려진 remote 상태:

Repository:

Riddlerio/s\_project

기존 MVP branch:

feature/speech-hero-mvp

기존 PR:

#1

현재 main에는 사용자가 직접 추가한 mascot reference image가 있다.

파일명:

20190610.010190759320001i1.jpg

중요:

현재 MVP feature branch에는 이 이미지가 없을 가능성이 있으므로

무작정 main과 feature를 merge해서 기존 작업을 덮어쓰지 않는다.

작업 시작 시:

git fetch origin

git status --short --branch

git log --oneline --decorate -10

git branch -a

로 실제 상태를 확인한다.

PR #1이 이미 main에 merge된 경우:

origin/main에서

feature/speech-hero-v2-tiger

브랜치를 생성한다.

PR #1이 아직 merge되지 않은 경우:

origin/feature/speech-hero-mvp

를 기준으로

feature/speech-hero-v2-tiger

브랜치를 생성한다.

그리고 mascot image만 안전하게 origin/main에서 가져온다.

예:

git checkout origin/main -- 20190610.010190759320001i1.jpg

또는 동일한 안전한 Git 방식을 사용한다.

main 전체를 무작정 merge하지 않는다.

기존 MVP 변경사항을 잃으면 안 된다.

# ============================================================

# 3. EXISTING SECURITY / ORCA ENVIRONMENT

# ============================================================

현재 Codex Hook 문제는 이미 해결 및 검증되었다.

필수 Hook:

SessionStart

UserPromptSubmit

PreToolUse

PostToolUse

Stop

이 모두 새로운 최상위 Codex session에서 Completed 된 상태이다.

따라서 이번 작업에서 절대 수정하지 않는다:

C:\\Users\\kor02\\.orca\\agent-hooks

C:\\Users\\kor02\\AppData\\Roaming\\orca\\codex-runtime-home

hooks.json

codex-hook.cmd

claude-hook.cmd

Orca CLI source

또한 이전에 Orca Codex execution timeout이

600000ms에서 더 긴 값으로 수정된 local Orca source가 존재한다.

이를 되돌리거나 수정하지 않는다.

Orca 자체 문제 해결 작업을 다시 시작하지 않는다.

금지:

npm audit fix --force

git reset --hard

git clean -fd

무차별 파일 삭제

기존 uncommitted 사용자 변경 삭제

main 직접 push

# ============================================================

# 4. CHARACTER REFERENCE

# ============================================================

공식 visual reference는 repository의:

20190610.010190759320001i1.jpg

이다.

이 이미지를 직접 분석 가능한 환경이면 분석하고 사용한다.

Vision이 불가능한 agent도 구현할 수 있도록

다음 특징을 기준으로 한다.

Character:

- 흰색 호랑이

- 검정/회색 줄무늬

- 둥근 큰 머리

- 작은 몸

- 짧은 팔과 다리

- 검은 타원형 눈

- 둥근 코

- 친근한 미소

- 목 주변 green/teal 계열 장식

- 뒤쪽 cape 느낌

- 전체적으로 귀엽고 단순한 mascot silhouette

최종 아동용 캐릭터는:

Stylized 3D

Short / Chibi proportion

Toy-like

Soft

Rounded

Friendly

여야 한다.

중요:

reference JPG를 단순히 화면 중앙에 띄워놓고

"3D 캐릭터 완료"라고 하지 않는다.

# ============================================================

# 5. 3D CHARACTER IMPLEMENTATION

# ============================================================

실제 authored GLB/GLTF model이 repository에 없다면

존재하지 않는 3D asset을 있다고 가정하지 않는다.

Claude는 기술을 검토하고 하나를 선택한다.

우선 검토 후보:

React Three Fiber

Three.js

Drei

Rive

PixiJS

Phaser

3D mascot 구현 현실성이 가장 높은 경우:

React Three Fiber + Three.js

기반 procedural stylized character를 구현할 수 있다.

예:

head:

sphere / rounded mesh

body:

capsule / rounded mesh

arms/legs:

capsules

ears:

rounded cone / sphere combinations

eyes:

simple toon meshes

mouth:

separate mouth mesh

cape:

simple geometry

stripe:

simple meshes / decals / materials

향후 전문 3D GLB 모델로 교체할 수 있도록:

TigerAvatarProvider

또는 equivalent component boundary를 만든다.

필수 animation state:

IDLE

BLINK

LISTENING

THINKING

TALKING

HAPPY

CHEER

ENCOURAGE

SURPRISED

GAME\_SUCCESS

GAME\_RETRY

캐릭터를 클릭/터치하면 반응해야 한다.

# ============================================================

# 6. TALKING / MOUTH ANIMATION

# ============================================================

캐릭터가 말할 때 입이 움직여야 한다.

1차 목표는 완전한 viseme lip-sync가 아니다.

우선 안정적인 lightweight 방식:

TTS START

↓

SPEAKING state

TTS audio amplitude 또는 analyser data

↓

MOUTH\_CLOSED

MOUTH\_HALF

MOUTH\_OPEN

TTS END

↓

IDLE

Audio analyser 사용이 어려운 fallback에서는

말하는 동안 자연스러운 random/rhythmic mouth movement를 사용한다.

하지만:

TALKING state가 아닐 때는 입 움직임을 중지한다.

향후:

phoneme / viseme based lip-sync

로 교체 가능하게 설계한다.

# ============================================================

# 7. PRODUCT CENTER = CHARACTER

# ============================================================

Speech Hero V2는 게임 선택 메뉴가 중심이 아니다.

앱의 중심은:

3D Tiger Companion

이다.

사용자가 로그인하면:

CHARACTER HOME

으로 진입한다.

구조 예:

--------------------------------

Lv. 8       오늘의 미션      ⭐

--------------------------------

             3D TIGER

        "오늘 뭐하고 놀까?"

    이야기하기      모험가기

    연습하기        보물함

--------------------------------

캐릭터의 상태와 progression은 유지된다.

# ============================================================

# 8. CLEAN CONVERSATION EXPERIENCE

# ============================================================

사용자의 명확한 요구:

"캐릭터와 대화할 때 배경은 깔끔하게"

대화 화면은 일부러 minimal하게 만든다.

금지:

복잡한 game HUD

많은 카드

과도한 배경 오브젝트

phoneme graph

점수판

clinical terminology

권장:

- clean light background

- subtle gradient

- soft ambient glow

- 충분한 whitespace

- 중앙 3D tiger

- 한 개의 speech bubble

- 하단 microphone control

- 작은 상태 indicator

예:

--------------------------------

&lt;                           ⚙



             TIGER

       "오늘 학교 어땠어?"

              🎙

          듣고 있어요...

--------------------------------

상태:

LISTENING

THINKING

SPEAKING

을 subtle animation으로 표시한다.

# ============================================================

# 9. CHARACTER CONVERSATION

# ============================================================

Tiger는 일반 chat window가 아니다.

캐릭터와 실제 음성 interaction을 제공한다.

Pipeline:

Child Speech

↓

VAD / Audio Quality

↓

SpeechRecognizer

↓

Dialogue Understanding

↓

Therapist Goal Context

↓

Target Word Strategy

↓

Dialogue Safety

↓

Character Response

↓

TTS

↓

MouthAnimationController

필요 abstraction:

CharacterDialogueProvider

ConversationService

ConversationMemoryStore

DialogueSafetyPolicy

TargetWordInjector

TherapistGoalContextProvider

TTSProvider

MouthAnimationController

대화 응답:

- 짧음

- 어린이 친화적

- 질문 하나씩

- 자연스러운 한국어

- target word 억지 삽입 금지

예:

Therapy target:

/ㅅ/

Tiger:

"간식 하나 챙기려고 해!

사과랑 바나나 중에 뭐가 좋을까?"

Child:

"사과"

아이는 대화를 하고 있다고 느낀다.

Pronunciation Engine은 background에서 평가한다.

# ============================================================

# 10. CHILD DIALOGUE SAFETY

# ============================================================

Character AI에는 강한 boundary를 둔다.

캐릭터는:

- 의료 진단 금지

- 치료사 역할 금지

- 비밀번호 요구 금지

- 주소/전화번호 요구 금지

- 학교 내 상세 개인정보 요구 금지

- 감정적 의존 조장 금지

- "나만 믿어" 같은 표현 금지

- 위험 행동 조언 금지

- 성인 주제 대화 금지

어린이에게 부적절한 요청에는

부드러운 안전 fallback을 사용한다.

Character LLM에는:

filesystem

shell

database admin

external tool execution

권한을 제공하지 않는다.

LLM response는 UI에 표시하기 전

server-side safety policy를 통과한다.

# ============================================================

# 11. LOGIN EXPERIENCE

# ============================================================

첫 화면을 새롭게 만든다.

Modern clean login.

입력:

학번

비밀번호

checkbox:

[ ] 관리자 로그인

button:

로그인

중요한 보안 의미:

관리자 로그인 checkbox는 오직 UI login intent이다.

절대 권한 자체가 아니다.

예:

student account

+

admin checkbox true

→ ADMIN이 되면 안 된다.

Backend DB role이:

STUDENT

이면 admin mode login을 거부한다.

# ============================================================

# 12. IMPORTANT: UNIVERSITY PASSWORD

# ============================================================

Speech Hero는 실제 대학교 포털 비밀번호를

수집하거나 저장하지 않는다.

"학번 + 비밀번호"에서 비밀번호는:

Speech Hero 전용 credential

이다.

실제 학교 인증과 향후 통합한다면:

공식 학교 SSO

OIDC

OAuth

SAML

등 승인된 방식만 사용한다.

절대 구현 금지:

학교 포털 비밀번호 scraping

학교 로그인 proxy

실제 포털 password DB 저장

Demo account는 가짜 학번과

Speech Hero용 password를 사용한다.

# ============================================================

# 13. ACCOUNT ROLES

# ============================================================

최소 role:

STUDENT

THERAPIST

ADMIN

로그인 checkbox가 STAFF intent라면

DB role로 실제 공간을 결정한다.

STUDENT

→ Character Home

THERAPIST

→ Therapist Studio

ADMIN

→ Admin Space

ADMIN만:

user management

role management

assignment management

audit access

가능.

THERAPIST는:

담당 아동/학생 데이터

training goals

sessions

pronunciation analysis

recommendations

만 접근.

# ============================================================

# 14. BACKEND AUTHORIZATION / RBAC

# ============================================================

Frontend route hiding은 security가 아니다.

Backend에서 반드시 검증한다.

필요 helper / dependency:

require\_authenticated\_user

require\_student

require\_therapist

require\_admin

require\_child\_access

IDOR를 막는다.

반드시 테스트:

Student A

→ Student B resource 접근

DENY

Therapist A

→ 자신에게 배정되지 않은 Student B

DENY

THERAPIST

→ /admin/users

DENY

STUDENT

→ /admin

DENY

# ============================================================

# 15. PASSWORD SECURITY

# ============================================================

plaintext password 절대 금지.

강한 password hash 사용.

우선 검토:

Argon2id

DB에는:

password\_hash

만 저장한다.

API response / log에서:

password

password\_hash

노출 금지.

로그인 failure는:

"로그인 정보를 확인해주세요."

같은 generic error를 사용한다.

Account enumeration을 막는다.

# ============================================================

# 16. SESSION SECURITY

# ============================================================

현재 bearer/sessionStorage auth 구조를 조사한다.

V2에서는 더 안전한 구조로 migration을 검토하고

가능하면 구현한다.

권장:

HttpOnly cookie

Secure in production

SameSite policy

session expiration

server-side role verification

logout invalidation

Cookie auth를 사용할 경우

CSRF protection / Origin checking도 설계한다.

Development HTTP와

Production HTTPS 차이를 명확하게 처리한다.

# ============================================================

# 17. LOGIN ATTACK PROTECTION

# ============================================================

Login endpoint에:

rate limiting

repeated failure protection

generic errors

session expiry

를 적용한다.

DoS를 유발할 정도로 복잡한 구조는 피한다.

# ============================================================

# 18. API / WEB SECURITY

# ============================================================

반드시 검토/구현:

CORS allowlist

input validation

Pydantic schema

request size limits

authentication

authorization

rate limiting

error sanitization

secure secrets

SQLAlchemy parameterization

security headers

Content-Security-Policy where practical

X-Content-Type-Options

Referrer-Policy

Permissions-Policy where practical

Frontend API key 저장 금지.

# ============================================================

# 19. CHILD DATA PRIVACY

# ============================================================

아동/학생 음성 데이터는 민감 데이터로 본다.

Raw Audio:

기본 영구 저장 금지.

Pronunciation model 평가가 raw audio를 필요로 한다면:

browser

↓

short encrypted HTTPS request

↓

in-memory evaluation

↓

discard

방식을 우선 검토한다.

별도 consent 없이는 training dataset으로 사용하지 않는다.

Transcript:

최소 저장

retention policy

delete/anonymize 지원

Conversation memory:

훈련에 필요한 최소 context만 유지.

아동의 민감한 자유대화를

무제한 장기 저장하지 않는다.

# ============================================================

# 20. AUDIT LOG

# ============================================================

민감내용 자체가 아닌

행동 metadata 중심 audit log를 구현한다.

후보:

LOGIN\_SUCCESS

LOGIN\_FAILURE

LOGOUT

ACCESS\_DENIED

GOAL\_UPDATED

THERAPIST\_INSTRUCTION\_APPROVED

RECOMMENDATION\_ACCEPTED

RECOMMENDATION\_MODIFIED

RECOMMENDATION\_REJECTED

ACCOUNT\_CREATED

ROLE\_CHANGED

저장:

actor\_id

action

resource\_type

resource\_id

timestamp

result

금지:

password

token

secret

raw audio

# ============================================================

# 21. PRONUNCIATION ENGINE = P0

# ============================================================

가장 중요한 기술 기능이다.

기존:

ASR transcript

→ 문자 비교

만으로 발음을 정확하게 판단하려 하지 않는다.

분리:

SpeechRecognizer

= 무엇을 말했는가

PronunciationEvaluator

= 어떻게 발음했는가

DialogueEngine

= 무슨 의미인가

# ============================================================

# 22. AUDIO PIPELINE

# ============================================================

권장 architecture:

Microphone

↓

Audio Quality Gate

↓

Noise Floor Calibration

↓

VAD / Speech Activity

↓

Audio Features

↓

+-----------------------------+

|                             |

v                             v

ASR                     Pronunciation



Transcript               Expected phones

                         Acoustic representation

                         Alignment

                         Phone evidence

                         Error estimation

                         Confidence

Raw audio를 DB에 저장하지 않고도

평가 가능하게 설계한다.

# ============================================================

# 23. PRONUNCIATION RESULT

# ============================================================

공통 result schema:

targetPhoneme

expectedPhones

observedPhones

phonemeScores

overallScore

confidence

errorPattern

evidence

modelVersion

audioQuality

Confidence:

HIGH

MEDIUM

LOW

UNCERTAIN

중요:

AI가 이해하지 못한 경우와

아이가 틀린 경우를

구분한다.

LOW / UNCERTAIN:

FAILURE로 처리 금지.

# ============================================================

# 24. ACOUSTIC TECHNOLOGY RESEARCH

# ============================================================

Plan agent는 가능한 경우

공식 자료 / 논문 / dataset primary source를 조사한다.

검토:

wav2vec2

HuBERT

WavLM

XLS-R

CTC phoneme recognition

forced alignment

GOP

phone posterior

phoneme-specific classification

현재 환경에서 internet research가 불가능하면

사실을 만들어내지 말고:

RESEARCH\_REQUIRED

로 기록한다.

# ============================================================

# 25. KOREAN CHILD SPEECH DATASET RESEARCH

# ============================================================

반드시 조사 후보에 포함:

AI-Hub Korean child speech

K-Univ Pathological-child-voice

Korean child articulation datasets

speech-sound-disorder research datasets

APAC

K-APP 관련 자료

각 후보마다:

dataset name

source

age

hours

number of speakers

utterance type

transcript

phoneme labels

error labels

license

commercial use

derivative model permission

privacy

ASR suitability

pronunciation suitability

evaluation suitability

를 조사한다.

라이선스가 애매하면:

UNKNOWN

OWNER\_PERMISSION\_REQUIRED

RESEARCH\_ONLY

중 하나로 정확하게 표시한다.

절대 라이선스가 검증되지 않은 데이터를

자동 download/fine-tune 하지 않는다.

# ============================================================

# 26. MODEL DEVELOPMENT ROADMAP

# ============================================================

한 번에 거대한 모델을 학습하려 하지 않는다.

설계:

Stage 0:

Current ASR baseline

Stage 1:

Forced alignment / GOP baseline

Stage 2:

SSL acoustic representation

Stage 3:

Child-speech adaptation

Stage 4:

Speech-sound-disorder adaptation

Stage 5:

Therapist correction calibration

각 단계에:

data

metrics

expected gain

compute

privacy

risk

를 정의한다.

# ============================================================

# 27. REAL AI VS BASELINE VS MOCK

# ============================================================

절대 가짜 결과를 AI라고 표시하지 않는다.

Provider boundary:

RealPronunciationProvider

BaselinePronunciationProvider

MockPronunciationProvider

Demo mode에서는 명확하게:

DEMO

표시.

현재 실제 acoustic model이 아직 준비되지 않았다면:

"ASR 기반 근사"

또는

"Baseline pronunciation evaluation"

이라고 표시한다.

# ============================================================

# 28. /ㅅ/ AND SUSTAINED SOUND SPECIAL CASE

# ============================================================

기존 게임에서 /ㅅ/ 지속 발화가 중요하다.

주의:

/ㅅ/ /s/는 무성 마찰음이므로

pitch/voicing detection만으로 발화를 판단하면 안 된다.

검토:

RMS / energy

noise floor

high-frequency energy ratio

spectral centroid

frication duration

Magic Beam / Sky Climb에서:

"스────"

같은 발화는

voice pitch가 없더라도

지속 발성으로 감지되어야 한다.

# ============================================================

# 29. THERAPIST = CLINICAL SUPERVISOR

# ============================================================

치료사는 단순 dashboard viewer가 아니다.

Therapist Studio에서:

아동 상태

목표

음소 경향

세션

AI confidence

게임 수행

추천

치료사 instruction

을 다룬다.

# ============================================================

# 30. NATURAL LANGUAGE THERAPIST ADVICE

# ============================================================

치료사는 자연어로 지시할 수 있다.

예:

"이번 주는 /ㅅ/ 어두 단어를 집중하고,

두 번 어려워하면 시각 힌트를 먼저 주세요.

세 번 이상 반복하지 말아주세요."

↓

TherapistInstructionParser

↓

Structured Preview

예:

targetPhoneme = ㅅ

position = initial

preferredCue = visual

maxAttempts = 3

priority = accuracy

↓

치료사 확인

Accept

Modify

Reject

승인 전에는

TrainingGoal에 적용하지 않는다.

# ============================================================

# 31. LLM SECURITY FOR THERAPIST PARSER

# ============================================================

자연어 instruction을 LLM이 처리하더라도

임의 코드/도구 실행으로 연결하지 않는다.

LLM output은 반드시

strict structured schema로 validation한다.

허용:

training configuration

금지:

shell

filesystem

database query

role changes

arbitrary endpoint execution

# ============================================================

# 32. QUESTION / CONTENT GENERATION

# ============================================================

치료사 instruction을 기반으로

문제와 target content를 추천한다.

예:

/ㅅ/ 어두

→

사과

사자

소리

수박

시계

그러나 LLM이 만든 단어를 그대로 사용하지 않는다.

ContentValidator가:

실제 target phoneme 존재

target 위치

중복

난이도

어휘 적합성

금지 콘텐츠

를 검사한다.

가능하면 validated Korean word bank를

source of truth로 사용하고

LLM은 selection/variation에 사용한다.

# ============================================================

# 33. ADAPTIVE GAME RECOMMENDATION

# ============================================================

GameRecommendationEngine 입력:

TrainingGoal

PronunciationProfile

RecentSessions

TherapistInstruction

GameHistory

ChildPreference

Engagement

출력:

gameId

reason

trainingSkill

difficulty

parameters

confidence

치료사:

Accept

Modify

Reject

# ============================================================

# 34. GAME REGISTRY

# ============================================================

게임을 각각 무질서하게 hard-code하지 않는다.

GameRegistry

GameDefinition:

id

name

trainingSkills

supportedPhonemes

supportedLevels

interactionType

difficultyRange

parameters

TrainingSkill:

PHONEME\_ACCURACY

SUSTAIN

REPETITION

RHYTHM

WORD\_PRODUCTION

SENTENCE\_PRODUCTION

SPONTANEOUS\_SPEECH

# ============================================================

# 35. GAME QUALITY — MAJOR PRIORITY

# ============================================================

기존 MVP의 단순 HTML/CSS 느낌에서

실제 modern mobile game 같은 느낌으로 개선한다.

화면을 예쁘게 꾸미는 수준이 아니라:

animation

game feel

feedback

particles

motion

state transition

sound

character reaction

을 사용한다.

# ============================================================

# 36. SKY CLIMB

# ============================================================

핵심:

발음/지속발화를 하는 동안 캐릭터 상승.

Audio activity

→ upward force

silence

→ smooth downward drift

speech resume

→ upward movement resume

필수:

smooth interpolation

cloud parallax

particle trail

goal rings

floating collectibles

character reaction

soft landing

visual progress

즉시 Game Over 금지.

# ============================================================

# 37. MONSTER ADVENTURE

# ============================================================

Target word

↓

Pronunciation evaluation

↓

spell charge

↓

attack effect

↓

monster reaction

↓

particle

↓

reward

Confidence:

HIGH + success

→ powerful attack

MEDIUM

→ weaker charge + friendly hint

LOW / UNCERTAIN

→ "다시 한번 들어볼게!"

AI uncertainty를

아동 실패로 만들지 않는다.

# ============================================================

# 38. MAGIC BEAM

# ============================================================

기존 Magic Beam을 재설계한다.

Sustained sound

→ beam energy

필수 visual:

charge ring

beam trail

glow

spark particle

impact effect

light pulse

character pose

responsive power bar

기존 단순 div width animation 수준에 머물지 않는다.

# ============================================================

# 39. CONVERSATION QUEST

# ============================================================

캐릭터 대화 자체도 하나의 game/quest가 된다.

예:

Tiger:

"오늘 피크닉 갈 건데 과일 하나 챙기자!"

↓

child talks

↓

target word detected

↓

Tiger reacts

↓

small reward / story progression

훈련이 겉으로 드러나지 않게 한다.

# ============================================================

# 40. GAME RENDERING STACK

# ============================================================

Claude는 현재 React/Vite architecture와

3D 요구를 기준으로 stack을 결정한다.

평가:

React Three Fiber / Three.js

PixiJS

Phaser

Canvas/WebGL

Motion

불필요하게 여러 rendering engine을 동시에 넣지 않는다.

가능하면 하나의 primary visual architecture를 선택한다.

선정 기준:

visual quality

mobile performance

integration

bundle size

developer complexity

testability

maintainability

# ============================================================

# 41. MODERN CHILD UI

# ============================================================

사용자의 강한 요구:

"옛날 앱처럼 보이지 않게"

아동 앱은:

2026 modern kids mobile app

느낌.

사용:

rounded geometry

soft depth

large touch targets

clean spacing

gradient lighting

micro interaction

spring motion

responsive

animated background where appropriate

consistent icons

high-quality typography

금지:

오래된 Bootstrap dashboard

plain HTML form look

table 중심 아동 UI

병원 software 느낌

# ============================================================

# 42. LOGIN VISUAL

# ============================================================

Login도 일반 관리자 페이지처럼 만들지 않는다.

깔끔한 card 또는 centered layout.

작은 mascot preview 가능.

불필요하게 화려하지 않음.

학번

비밀번호

관리자 로그인 checkbox

로그인

에 집중한다.

# ============================================================

# 43. THERAPIST UI

# ============================================================

Therapist UI는 child UI와 visual language를 분리한다.

Professional

Calm

Structured

Readable

필수:

Overview

Student Detail

Current Goal

Pronunciation Profile

Session Trend

Phoneme Trend

Therapist Instruction

Game Recommendation

Pending AI Recommendation

Accept / Modify / Reject

History

Decision reason

# ============================================================

# 44. ADMIN UI

# ============================================================

ADMIN 전용:

/admin

/admin/users

/admin/students

/admin/therapists

/admin/assignments

/admin/audit

권한 변경은 ADMIN만.

Therapist가 role을 변경할 수 없어야 한다.

# ============================================================

# 45. PROGRESSION

# ============================================================

Tiger progression:

XP

Level

Bond

Items

Achievements

Cosmetics

중요:

Pronunciation accuracy만으로

성장이 결정되면 안 된다.

XP는:

참여

시도

재도전

conversation

game completion

mission completion

등에도 제공.

발음이 어려운 아이가

캐릭터 성장에서 불리하면 안 된다.

# ============================================================

# 46. DATABASE V2

# ============================================================

기존:

Child

Therapist

TrainingGoal

TrainingSession

Utterance

SpeechAnalysis

TrainingDecision

AIRecommendation

TherapistFeedback

을 보존/마이그레이션하며 검토한다.

후보:

UserAccount

StudentProfile

TherapistProfile

StaffAssignment

CharacterState

CharacterItem

ConversationSession

ConversationTurn

PronunciationProfile

PhonemeMetric

TherapistInstruction

TrainingAssignment

GameDefinition

GameRecommendation

GameSession

RewardLedger

AuditEvent

AuthSession

모든 후보를 무조건 table로 만들지 않는다.

필요한 것만 선택.

# ============================================================

# 47. SECRETS

# ============================================================

절대 Git commit 금지:

.env

API key

LLM key

auth secret

private token

.env.example에는 placeholder만.

Frontend bundle에

server secret가 포함되지 않도록 검사한다.

# ============================================================

# 48. LLM PROVIDER

# ============================================================

Character conversation과

Therapist instruction parsing은

provider interface를 사용한다.

예:

DialogueProvider

TherapistInstructionProvider

실제 provider key는 backend 환경변수에만 둔다.

API key가 없을 때:

DemoDialogueProvider

DeterministicTherapistParser

등 안전한 fallback을 제공할 수 있다.

DEMO를 REAL AI라고 표시하지 않는다.

# ============================================================

# 49. NPM SECURITY

# ============================================================

현재 dependency/security docs도 읽는다.

특히:

docs/[security-audit.md](http://security-audit.md)

가 있으면 반드시 확인한다.

실행:

npm.cmd audit --json

npm.cmd audit --omit=dev

취약점 구분:

runtime

dev

direct

transitive

actual exploitability

금지:

npm audit fix --force

Patch/minor safe update는

테스트 후 적용 가능.

Major update는

regression risk를 조사하고

필요하면 blocker가 아닌 documented risk로 남긴다.

# ============================================================

# 50. SECURITY TESTS

# ============================================================

필수 automated security tests:

STUDENT credentials

+

admin checkbox

→ ADMIN 권한 획득 불가

Student token/session

→ /admin DENY

Therapist

→ admin account-management DENY

Student A

→ Student B records DENY

Therapist A

→ unassigned student DENY

No auth

→ protected endpoint 401

Expired/invalid session

→ DENY

Wrong password

→ generic error

Password

→ plaintext DB 저장되지 않음

API response

→ password\_hash 없음

Secrets

→ Git tracked files 없음

# ============================================================

# 51. AUDIO / PRIVACY TEST

# ============================================================

검증:

raw audio DB 저장되지 않음

temporary audio cleanup

no-audio flow

permission denied

unsupported browser

background noise

short utterance

long utterance

uncertain result

ASR mismatch

/s/ sustained fricative

TTS talking animation

# ============================================================

# 52. FRONTEND TESTS

# ============================================================

최소 테스트:

Login

Admin checkbox

Role routing

Character states

Mouth animation state

Conversation state

Dialogue fallback

Pronunciation confidence

UNCERTAIN !== FAILURE

Sky Climb state

Monster Adventure state

Magic Beam state

Game Recommendation

Therapist Instruction Preview

Accept

Modify

Reject

# ============================================================

# 53. BACKEND TESTS

# ============================================================

최소:

authentication

password hashing

RBAC

IDOR

session expiration

logout

therapist assignment

goal versioning

utterance

pronunciation schema

uncertainty

therapist instruction

game recommendation

audit events

retention behavior

# ============================================================

# 54. DOCUMENTATION

# ============================================================

Codex는 implementation에 맞춰:

docs/v2/

아래를 만든다.

PRODUCT\_[VISION.md](http://VISION.md)

ARCHITECTURE\_[V2.md](http://V2.md)

TIGER\_3D\_[SYSTEM.md](http://SYSTEM.md)

CHARACTER\_[DIALOGUE.md](http://DIALOGUE.md)

PRONUNCIATION\_[ENGINE.md](http://ENGINE.md)

DATASET\_[RESEARCH.md](http://RESEARCH.md)

PRONUNCIATION\_EVAL\_[PLAN.md](http://PLAN.md)

GAME\_[SYSTEM.md](http://SYSTEM.md)

GAME\_[RECOMMENDATION.md](http://RECOMMENDATION.md)

THERAPIST\_[LOOP.md](http://LOOP.md)

AUTH\_AND\_[RBAC.md](http://RBAC.md)

SECURITY\_[ARCHITECTURE.md](http://ARCHITECTURE.md)

SECURITY\_THREAT\_[MODEL.md](http://MODEL.md)

PRIVACY\_AND\_[AUDIO.md](http://AUDIO.md)

DATABASE\_[V2.md](http://V2.md)

API\_[V2.md](http://V2.md)

UI\_DESIGN\_[SYSTEM.md](http://SYSTEM.md)

TEST\_[STRATEGY.md](http://STRATEGY.md)

MANUAL\_AUDIO\_[TEST.md](http://TEST.md)

COMPETITION\_[DEMO.md](http://DEMO.md)

VALIDATION\_[REPORT.md](http://REPORT.md)

[DECISIONS.md](http://DECISIONS.md)

문서는 실제 구현과 일치해야 한다.

# ============================================================

# 55. COMPETITION DEMO EXPERIENCE

# ============================================================

3분 내 demonstration을 목표로 한다.

FLOW A — STUDENT

Login

↓

학번 + password

↓

Tiger Character Home

↓

Tiger와 음성 대화

↓

Tiger가 LISTENING

↓

child speech

↓

Tiger THINKING

↓

Tiger TTS response

↓

mouth 움직임

↓

target word 자연스럽게 유도

↓

pronunciation analysis

↓

recommended activity/game

↓

Sky Climb 또는 Monster Adventure

↓

reward

↓

character reaction

FLOW B — THERAPIST

Staff login

↓

Student profile

↓

pronunciation profile

↓

natural language advice

↓

structured preview

↓

Accept / Modify

↓

recommended game

↓

다음 assignment

FLOW C — ADMIN

Admin checkbox

↓

실제 ADMIN account verify

↓

Admin Space

↓

user / assignment / audit

# ============================================================

# 56. DEMO RESILIENCE

# ============================================================

공모전 환경에서:

인터넷 문제

LLM API 문제

마이크 문제

가 발생할 수 있다.

따라서:

DEMO MODE

를 유지한다.

그러나 화면에 명확하게:

DEMO

를 표시한다.

Fallback:

scripted dialogue

scripted recognition

local game

seed data

를 제공한다.

실제 기능처럼 속이지 않는다.

# ============================================================

# 57. PERFORMANCE

# ============================================================

목표:

mobile-first

smooth interaction

3D home preferably 60fps on reasonable hardware

audio processing이 React render thread를 과도하게 막지 않음

검토:

Web Audio

AudioWorklet

Worker

efficient Three.js rendering

3D polygon / texture를 과도하게 키우지 않는다.

prefers-reduced-motion도 고려한다.

# ============================================================

# 58. ACCESSIBILITY

# ============================================================

아동 UI:

큰 touch target

충분한 contrast

텍스트만으로 상태 전달 가능

sound-only feedback 금지

Therapist UI:

keyboard navigation

semantic controls

labels

focus state

를 유지한다.

# ============================================================

# 59. IMPLEMENTATION ORDER

# ============================================================

Claude Plan에서 구체화하되 기본 우선순위:

P0

Secure Auth / RBAC

Core V2 schema

Pronunciation architecture

Tiger 3D Companion

Conversation core

P1

Therapist instruction loop

Validated content generation

Game Registry

Game Recommendation

Sky Climb

Monster Adventure

Magic Beam upgrade

P2

Advanced progression

cosmetic system

additional polish

advanced pronunciation model experiments

그러나 security는 마지막에 붙이는 기능이 아니다.

각 phase와 함께 구현한다.

# ============================================================

# 60. PHASE CHECKPOINTS

# ============================================================

Codex는 큰 단계마다:

typecheck

relevant tests

git diff review

를 수행한다.

가능하면 logical commits로 나눈다.

예:

feat: add secure account and role model

feat: add tiger companion experience

feat: add conversational companion pipeline

feat: add pronunciation evaluation architecture

feat: add adaptive training recommendation

feat: upgrade speech games

feat: add therapist interactive planning

test: add security and v2 integration coverage

docs: document speech hero v2

# ============================================================

# 61. FULL VALIDATION

# ============================================================

최종적으로 반드시 실행:

npm.cmd install

npm.cmd run typecheck

npm.cmd test

npm.cmd run build

Backend:

backend\\.venv\\Scripts\\python.exe -m pytest backend -q

API smoke:

기존 smoke를 업데이트하거나

V2 smoke script 작성.

검증:

login

student

therapist

admin

conversation

session

game

recommendation

therapist decision

그리고:

git diff --check

npm audit 결과 기록.

# ============================================================

# 62. LOCAL SERVER SMOKE

# ============================================================

가능한 경우 실제 local servers를 실행한다.

FastAPI

Vite

확인:

/

login route

character home route

conversation route

therapist route

admin route

/api/system/info

authentication

API proxy

모두 HTTP 정상 응답.

# ============================================================

# 63. DO NOT FAKE PHYSICAL TESTS

# ============================================================

Codex/Claude가 실제 microphone을

직접 물리적으로 들을 수 없는 환경이라면:

"actual microphone quality test PASS"

라고 주장하면 안 된다.

대신:

MANUAL\_AUDIO\_[TEST.md](http://TEST.md)

를 제공하고

NOT MANUALLY VERIFIED

라고 기록한다.

3D rendering도 실제 브라우저 렌더를

확인할 수 없다면 그 사실을 기록한다.

# ============================================================

# 64. README

# ============================================================

README를 한국어 중심으로 업데이트한다.

포함:

Speech Hero V2 소개

왜 필요한가

Tiger Character

Conversation

Speech Architecture

Pronunciation limitation

Therapist loop

Games

Student login

Admin/staff login

Security model

Privacy

Install

Run

Demo accounts

Tests

Project structure

Known limitations

# ============================================================

# 65. GIT FINALIZATION

# ============================================================

작업 branch:

feature/speech-hero-v2-tiger

main 직접 push 금지.

최종:

git status

git diff --check

tests

build

security tests

commit

push

PR #1을 V2 PR로 무리하게 변경하지 않는다.

V2는 별도 PR을 만든다.

예:

feat: Speech Hero V2 tiger companion platform

gh authentication이 없으면:

token을 요구하거나

credential을 임의 생성하지 않는다.

branch push까지 완료하고

PR\_CREATE\_BLOCKED\_BY\_GH\_AUTH

를 보고한다.

# ============================================================

# 66. FINAL ACCEPTANCE GATE

# ============================================================

다음이 충족되기 전에는

READY라고 말하지 않는다.

TypeScript typecheck PASS

Frontend tests PASS

Frontend production build PASS

Backend tests PASS

API smoke PASS

Auth tests PASS

RBAC tests PASS

IDOR tests PASS

Student cannot become admin PASS

Password hashing PASS

Character Home implemented

3D Tiger implemented

Talking mouth state implemented

Conversation flow implemented

Pronunciation architecture implemented

UNCERTAIN behavior tested

Therapist instruction flow implemented

Game recommendation implemented

At least Sky Climb implemented at quality target

Monster Adventure implemented

Magic Beam upgraded

Security docs updated

No committed secrets

git diff --check PASS

feature branch used

push success

PR 생성은 gh auth가 존재하면 필수.

실제 microphone manual validation과

실제 acoustic model accuracy는

automation으로 검증할 수 없는 경우

명확하게 별도 limitation으로 표시한다.

# ============================================================

# 67. FINAL REPORT

# ============================================================

Codex Execute final report:

STATUS:

READY

or

NOT READY

그리고 보고:

Branch

Commit hashes

Push status

PR URL / blocker

3D Tiger status

Character animation

Mouth animation

Conversation status

Dialogue provider status

Pronunciation provider status

REAL vs BASELINE vs DEMO

Dataset research

Therapist system

Game recommendation

Games

Student auth

Therapist auth

Admin auth

RBAC

IDOR protection

Security changes

npm audit before/after

Frontend tests

Backend tests

Build

API smoke

Manual checks still required

Known limitations

Claude Review는 이 최종 보고를 그대로 믿지 말고:

repository diff

tests

security implementation

architecture

를 실제로 검사한 후 평가한다.

# ============================================================

# 68. PRODUCT SUCCESS CRITERION

# ============================================================

최종 결과는:

"발음을 하면 간단한 공격이 나오는 웹 미니게임"

처럼 보여서는 안 된다.

사용자가 처음 봤을 때:

"귀여운 3D 캐릭터와 실제로 대화하면서 같이 놀 수 있는 앱"

으로 보여야 한다.

기술 발표에서는 그 뒤에:

Audio AI

Pronunciation Intelligence

Adaptive Training

Therapist Human-in-the-loop

Secure RBAC

가 존재한다는 것이 보여야 한다.

아동 경험은:

Character first.

치료사 경험은:

Evidence + Control first.

AI architecture는:

Uncertainty-aware.

Security는:

Backend enforced.

이 네 가지를 최우선 원칙으로 유지한다.