\# =====================================================================

\# SPEECH HERO V2 — FINAL IMPLEMENTATION REMEDIATION SPEC

\# Rev.7 / FINAL POST-REVIEW EXECUTION CONTRACT

\# =====================================================================



BEGIN FINAL REMEDIATION SPEC





\## 0. 이 문서의 목적



현재 `.orca/tasks/4/review.md`의 최종 리뷰 결과는 승인할 수 없다.



현재 구현은 전체 Speech Hero V2 plan을 완료한 상태가 아니다.



Claude review에서 확인된 실제 상태는 다음과 같다.



완료:

\- W0 일부 `.gitignore`

\- W3 일부 브라우저 음성 처리

\- Magic Beam용 /ㅅ/ 지속 발성 판단 일부



미완료:

\- 안전한 V2 Git branch 분리

\- 실제 테스트 검증

\- 서버 acoustic validation

\- 보안 / 인증 / RBAC

\- IDOR 방어

\- 3D Hoya

\- Character Home

\- Speech is the Controller 전체 구조

\- Clinical Meaning Layer

\- Therapist Evidence workflow

\- Conversation

\- Conversation Quest

\- Sky Climb

\- Monster Adventure 개편

\- Therapist Dashboard

\- Clinical graphs

\- Adaptive Recommendation

\- 문서화

\- Validation Report

\- PR



따라서 현재 review를 PASS로 처리하지 않는다.



이 문서는 새로운 제품 요구사항을 추가하는 문서가 아니라,

현재 승인된 `.orca/tasks/4/plan.md`와 `review.md`를 실제 구현 상태와 맞추기 위한

FINAL REMEDIATION / COMPLETION CONTRACT이다.





\## 1. Source of Truth 우선순위



작업 시작 전에 다음 파일을 UTF-8로 처음부터 끝까지 읽어라.



1\. `.orca/tasks/4/plan.md`

2\. `.orca/tasks/4/review.md`

3\. `SPEECH\_HERO\_V2\_TASK.md`

4\. `SPEECH\_HERO\_V2\_DECISIONS.md`

5\. `SPEECH\_HERO\_V2\_CLINICAL\_MEANING\_FINAL.md`

6\. 이 파일 `SPEECH\_HERO\_V2\_FINAL\_REMEDIATION.md`



존재하지 않는:



`SPEECH\_HERO\_V2\_CLINICAL\_ADDENDUM.md`



파일은 blocker로 취급하지 마라.



Rev.4에서 필요했던 핵심 내용은 이미 plan / Rev.5 / Review Remediation 요구로 흡수해서 처리한다.



최종 구현 source of truth는:



현재 `.orca/tasks/4/plan.md`

\+

현재 `.orca/tasks/4/review.md`

\+

이 Final Remediation Spec



이다.





\## 2. Review 결과는 CHANGES\_REQUIRED이다



현재 review 결과를 승인으로 바꾸지 마라.



단순히 `review.md` 문구만 수정해서 완료 처리하지 마라.



가능한 Orca review → execute QA back-edge를 사용해서

Codex 구현 단계로 실제 수정 작업을 다시 보내라.



Codex는 production code / tests / docs / Git을 실제로 수정해야 한다.



수정 후 Claude가 다시 실제 repository를 검토한다.



필요하면 허용된 QA round를 순서대로 사용한다.



권장 라운드:



ROUND 1

Git 안전화 + 테스트 기반 복구 + 현재 버그 + M1 완성



ROUND 2

M2 핵심 제품 완성



ROUND 3

M3 polish + 전체 validation + docs + PR



한 라운드 안에서 모든 것을 억지로 병렬 구현하지 않는다.



M1이 검증되지 않은 상태에서 M2/M3 완료라고 주장하지 않는다.





\# =====================================================================

\# PHASE A — REPOSITORY SAFETY

\# =====================================================================



\## 3. Git branch 문제를 가장 먼저 해결



현재 review에 따르면 V2 변경이:



`feature/speech-hero-mvp`



위에 직접 존재한다.



이 상태로 commit하면 기존 MVP PR #1을 오염시킬 수 있다.



따라서 production code를 더 수정하기 전에 Git 상태를 조사한다.



반드시 확인:



git status --short

git branch --show-current

git log --oneline -5

git branch -a

git diff --stat

git diff



기존 working tree 변경을 절대 잃지 않는다.



금지:



git reset --hard

git clean -fd

강제 checkout

강제 branch 삭제

사용자 변경 삭제

무조건 stash 후 유실 가능성이 있는 작업

main 전체 merge



특히:



`.agents/skills/release-pr-readme/SKILL.md`



등 사용자가 기존에 수정한 파일을 삭제하거나 덮어쓰지 않는다.



현재 HEAD가 계획에서 확인한 MVP 기반이고

`feature/speech-hero-v2-tiger`가 아직 존재하지 않는다면

현재 working tree를 그대로 보존하면서 새 branch를 생성한다.



예상 의도:



feature/speech-hero-mvp

&#x20;       ↓ base

feature/speech-hero-v2-tiger



단 실제 명령 전에 branch 존재 여부와 HEAD를 확인한다.



이미 branch가 존재하면 덮어쓰지 말고 상태부터 검사한다.



V2 작업은 최종적으로:



feature/speech-hero-v2-tiger



에서 진행해야 한다.





\## 4. Mascot asset



`origin/main`에 존재하는:



20190610.010190759320001i1.jpg



만 필요한 경우 가져온다.



main 전체를 merge하지 않는다.



이 이미지는 user-designated visual reference이다.



단 이미지 파일을 화면에 띄우는 것만으로

"3D Hoya 구현 완료"라고 주장하면 안 된다.





\# =====================================================================

\# PHASE B — TEST BASELINE

\# =====================================================================



\## 5. 현재 README 테스트 주장을 검증



Claude review에 따르면:



\- backend "18 passed"는 이 review에서 재검증되지 않음

\- Vitest는 실행되지 못함

\- sustainTracker.test.ts도 실행 검증 없음



따라서 기존 README의 PASS 문구를

현재 검증된 사실처럼 사용하지 않는다.



실제로 실행을 시도한다.



Backend:



backend\\.venv\\Scripts\\python.exe -m pytest backend -q



Frontend:



npm.cmd run typecheck

npm.cmd test

npm.cmd run build



그리고:



git diff --check



가능하다면:



npm.cmd audit --json



도 실행한다.



실행 결과를 정확하게 보존한다.





\## 6. 테스트 실행이 승인 문제로 막힐 경우



tool approval / sandbox 제한 때문에 실행하지 못하는 경우:



PASS라고 쓰지 않는다.



상태:



BLOCKED BY EXECUTION APPROVAL



또는:



NOT EXECUTED



로 기록한다.



하지만 테스트 실행 승인이 안 된다는 이유만으로

나머지 production implementation을 중단하지 않는다.



구현 가능한 부분은 계속 구현한다.



마지막 보고에서

사용자가 직접 실행할 정확한 명령을 제공한다.





\# =====================================================================

\# PHASE C — REVIEW에서 잡힌 실제 버그 수정

\# =====================================================================



\## 7. B1/B2 — AcousticSummary strict validation



현재 review에서 가장 중요한 서버 버그 중 하나이다.



문제:



acoustic 입력에 strict validation schema가 없음.



`bestRunMs`

`voicedMs`

및 관련 acoustic value에 잘못된 타입이 들어오면



progress.recompute

policy.py



등에서 TypeError가 발생하여 HTTP 500으로 이어질 수 있다.



이를 수정한다.



Pydantic 기반:



AcousticSummary



또는 동등한 explicit schema를 만든다.



현재 실제 frontend/backend payload를 먼저 조사하고

존재하지 않는 field를 임의로 만들어 넣지 않는다.



모든 numeric acoustic field:



\- type validation

\- finite validation

\- non-negative duration

\- ratio range validation

\- 필요한 상한

\- malformed input rejection



을 구현한다.



예:



duration:

>= 0



ratio:

0 <= x <= 1



NaN / Infinity:

reject



string where number expected:

reject



invalid payload는:



HTTP 422 또는 명시된 client error



가 되어야 하며 500이 되면 안 된다.



validation 이전 raw value가:



DB

policy

progress calculation



으로 들어가지 않게 한다.





\## 8. Invalid payload tests



최소 테스트:



string bestRunMs

negative bestRunMs

invalid voicedMs

ratio > 1

ratio < 0

NaN equivalent / invalid JSON if applicable

missing optional values

oversized payload

unknown malformed structure



검증.



어떤 invalid acoustic payload도

TypeError 500을 만들면 안 된다.





\## 9. Retry counter bug



review:



uncertain이 아닌 결과가 한 번 발생하면

다시 듣기 count가 0으로 reset되고 있으며

"같은 target 기준 retry"가 아니다.



수정한다.



retry state는 최소한:



session

activity

target

attempt sequence



맥락을 가진다.



동일 target에 대한:



UNCERTAIN

LOW CONFIDENCE

POOR AUDIO



재시도를 추적한다.



다음 target으로 정상 진행하거나

명시적으로 activity가 전환될 때 reset한다.



중간에 다른 state가 발생했다는 이유만으로

의미 없이 retry count를 reset하지 않는다.





\## 10. UNCERTAIN을 실패 상태로 기록하지 않는다



현재 frontend Magic Beam에서

다시 듣기 상황에서도:



RESULT success:false



상태로 들어가는 문제가 review에서 발견되었다.



수정한다.



다음 상태를 의미적으로 분리한다.



SUCCESS

RETRY

UNCERTAIN

NEUTRAL\_CONTINUE

FAILURE — 필요한 경우에만



LOW/UNCERTAIN/POOR\_AUDIO는:



child failure가 아니다.



ClinicalObservation에서도:



incorrect



와



uncertain



을 같은 값으로 저장하지 않는다.



아이 화면에서도 실패 연출을 하지 않는다.





\## 11. Audio-quality browser/server 불일치



review:



clipping 상황에서

browser = FAIR

server = UNCERTAIN



으로 서로 다른 의미를 사용한다.



하나의 canonical policy를 만든다.



plan에서 확정한 audio-quality semantics / threshold를 기준으로 한다.



동일 입력에 대해 browser와 backend가

치료적 의미가 달라지는 결과를 만들어서는 안 된다.



특히 acoustic interpretation이 신뢰하기 어려운 clipping은

발음 실패가 아니라:



UNCERTAIN / RETRY



계열로 처리한다.



가능하면 공통 constants/spec을 두고

양쪽 테스트를 작성한다.





\## 12. 측정 region 불일치



review:



bestRunMs는 speech detection region 바깥 소리까지 포함할 수 있으나

fricationRatio는 speech region 안에서 계산됨.



수정한다.



지속 발성 길이와 마찰음 evidence가

동일하게 정의된 valid analysis region을 사용하도록 한다.



예:



VAD/energy-gated valid acoustic region

→ sustain segmentation

→ frication analysis



순서를 일관되게 한다.



각 metric이 다른 window를 쓴다면

그 이유를 명시하고 테스트한다.



숨겨진 measurement mismatch를 두지 않는다.





\# =====================================================================

\# PHASE D — SECURITY / AUTH / RBAC

\# =====================================================================



\## 13. 현재 review의 보안 문제를 P0로 처리



review에서 확인:



\- unauthenticated play-code access

\- sessionStorage token

\- login error response에서 input 노출

\- 전체 RBAC 미구현



M1 전에 해결한다.





\## 14. Authentication



Speech Hero 자체 account를 사용한다.



학생 로그인:



학번

\+

Speech Hero password



관리자 체크박스는:



"관리자 login intent"



일 뿐 권한을 부여하지 않는다.



실제 role은 backend DB에서 결정한다.



실제 학교 portal password를 요구/저장/프록시하지 않는다.





\## 15. Password security



plaintext 금지.



Argon2id 또는 현재 plan에서 확정한 secure hash를 구현한다.



DB에는 password hash만 저장.



API response / logs / audit event에:



password

password\_hash

token



을 출력하지 않는다.





\## 16. Session architecture



기존 sessionStorage bearer token 구조를 조사한다.



Rev.6 plan의 최종 secure session architecture로 전환한다.



가능하면:



Secure

HttpOnly

SameSite



cookie 기반 session.



cookie auth를 쓴다면:



CSRF protection

및/또는

Origin validation



을 구현한다.



development와 production 설정을 구분한다.



SECRET\_KEY 등의 production weak default를 금지한다.





\## 17. Backend RBAC



Role:



STUDENT

THERAPIST

ADMIN



backend helper 또는 dependency:



require\_authenticated\_user

require\_student

require\_therapist

require\_admin

require\_child\_access



또는 동등한 구조 구현.



Frontend guard는 UX일 뿐

보안 경계가 아니다.





\## 18. IDOR



반드시 automated test:



Student A → Student B 데이터 접근 차단



Therapist A → 미배정 Student B 접근 차단



Student → therapist data 차단



Student → admin endpoint 차단



Therapist → admin account-management 차단



직접 URL id 변경 차단



missing auth 차단



expired session 차단



logout 후 session 재사용 차단





\## 19. Login response



로그인 실패:



"로그인 정보를 확인해주세요"



같은 generic error.



입력한 password

account existence

role secret

raw request



노출 금지.





\## 20. Public/demo route



기존 unauthenticated play route가 필요하다면

production student/session data와 완전히 분리된

explicit DEMO context에서만 허용한다.



public demo route가

실제 child/session/clinical data에 접근하면 안 된다.





\# =====================================================================

\# PHASE E — M1: 최소 시연 단위 완성

\# =====================================================================



\## 21. M1은 반드시 실제 동작해야 함



M1 acceptance path:



Secure Login

→ Student Authentication

→ 3D Hoya Character Home

→ Magic Beam

→ Child Voice

→ Hoya Action

→ ClinicalObservation

→ Therapist Login

→ Session Timeline

→ Evidence Card

→ Confirm / Correct / Reject



이 경로가 실제로 연결되어야 한다.



placeholder component만 존재하면 완료가 아니다.





\# =====================================================================

\# PHASE F — 3D HOYA

\# =====================================================================



\## 22. 실제 3D avatar



React Three Fiber + Three.js 기반

현재 plan의 architecture를 따른다.



authored GLB가 없다면

procedural R3F tiger를 구현해도 된다.



단:



flat jpg

CSS sprite

정적 `<img>`



를 3D Hoya라고 부르지 않는다.





\## 23. Shared Hoya



Rev.6 원칙:



가능하면 앱 전체에서 하나의 3D scene / shared avatar architecture를 사용하고

scene/state만 바꾼다.



같은 Hoya:



Character Home

Conversation

Sky Climb

Monster Adventure

Magic Beam

Conversation Quest

Reward



에서 identity/material/proportion/accessory를 유지한다.





\## 24. Hoya appearance



user-designated reference의 핵심:



white tiger

dark stripe

teal/green scarf/cape/accessory

friendly chibi proportions

large head

rounded body

short limbs

soft toy-like impression



을 시각적 기준으로 사용한다.





\## 25. M1 Hoya states



최소:



IDLE

BLINK

LISTENING

CHARGE

BEAM

ENCOURAGE

HAPPY



실제 state transition이 화면에서 확인 가능해야 한다.



나머지 상태는 M2/M3에서 확장.





\## 26. Home first impression



Student 로그인 직후:



Character Home



으로 이동.



Hoya가 화면 중심.



Rev.6의 첫인상 기준:



Hoya entrance

greeting

small idle animation

touch/click reaction



을 구현한다.





\# =====================================================================

\# PHASE G — SPEECH IS THE CONTROLLER

\# =====================================================================



\## 27. 공통 control pipeline



반드시 실제 코드 구조로 존재:



Speech Engine

↓

normalized SpeechGameSignal

↓

GameActionMapper

↓

HoyaActionController

↓

3D Hoya Action



게임마다 microphone code를 제멋대로 중복 구현하지 않는다.





\## 28. normalized signals



예:



VOICE\_START

VOICE\_CONTINUE

VOICE\_END

TARGET\_SUCCESS

TARGET\_RETRY

UNCERTAIN



필요한 확장은 가능하나

semantic meaning을 명확히 한다.





\## 29. Magic Beam



아동:



말소리/지속 발성



↓



Hoya가 실제로:



CHARGE

→ CAST/BEAM

→ RELEASE



한다.



대리 energy bar만 움직이고

Hoya가 정적인 장식이면 acceptance 실패.





\## 30. /ㅅ/ 처리



/ㅅ/은 무성 마찰음이므로

pitch/voicing만으로 판정하지 않는다.



기존 구현의:



energy

frication ratio

high-frequency evidence

duration



등 현재 plan의 baseline을 유지/보완한다.



이는 clinical-grade pronunciation model이라고 주장하지 않는다.





\# =====================================================================

\# PHASE H — CHILD-CENTERED PACING

\# =====================================================================



\## 31. 발화 끝난 직후 재촉 금지



아동이 말을 멈춘 즉시:



0ms

→ "다시 말해"



가 되면 안 된다.



구조:



speech end candidate

↓

PostUtteranceGracePeriod

↓

추가 발화 확인

↓

실제 completion

↓

processing





\## 32. 느린 반응 지원



반응 시간이 긴 아이를 실패로 판단하지 않는다.



Therapist-configurable:



responseGraceMs

retryDelayMs

cueDelayMs

maxAttempts



또는 동등한 policy 제공.





\## 33. Gentle retry



LOW / UNCERTAIN / POOR\_AUDIO:



잠시 기다림

↓

Hoya LISTENING / ENCOURAGE

↓

친근한 문구



예:



"내가 조금 놓쳤나 봐. 준비되면 한 번만 더 들려줄래?"



"천천히 해도 좋아. 준비되면 다시 한번 말해줄래?"



"호야가 귀 기울이고 있을게. 준비되면 말해줘!"





\## 34. 두 번 다시 듣기 후 게임 정지 금지



Rev.6 기준:



uncertain 상황이 반복되어도

아이를 같은 발화에서 계속 붙잡지 않는다.



정해진 retry 이후:



NEUTRAL\_CONTINUE



로 게임을 이어간다.



실패 animation

HP 감소

XP 감소

캐릭터 실망

벌점



금지.





\## 35. Fatigue protection



기본 activity length / 휴식 policy 등

현재 Rev.6 plan을 따른다.



아이에게 필요 시:



다시 해볼래

힌트 볼래

다른 걸 해볼래

잠깐 쉴래



같은 선택지를 제공한다.





\# =====================================================================

\# PHASE I — CLINICAL MEANING LAYER

\# =====================================================================



\## 36. 핵심 제품 철학



아이에게는:



PLAY



치료사에게는:



CLINICALLY MEANINGFUL EVIDENCE



같은 interaction이 두 의미를 가져야 한다.





\## 37. Clinical pipeline



반드시 실제 architecture:



Game/Speech Event

↓

ClinicalMeaningMapper 또는 동등 계층

↓

ClinicalObservation

↓

Session Evidence Store

↓

Therapist UI

↓

Confirm / Correct / Reject

↓

next clinical decision





\## 38. ClinicalObservation



activity에 맞게 최소한 다음 context를 저장할 수 있어야 한다.



observationId

studentId

sessionId

timestamp

gameId/activity

targetLevel

targetPhoneme

targetWord

wordPosition

expectedPhones

observedPhones

attemptNumber

responseLatency

speechDuration/sustainDuration

cueType

cueLevel

independence

pronunciation result

AI confidence

audio quality

error hypothesis

retry reason

generalization level

provenance

verification state



모든 field를 강제로 필수화하지 않는다.



활동에 따라 nullable.





\## 39. Provenance



명확하게 구분:



SYSTEM\_MEASURED

AI\_ESTIMATED

THERAPIST\_VERIFIED

THERAPIST\_ENTERED

CAREGIVER\_REPORTED — 실제 사용 시



게임 score와 clinical evidence를 섞지 않는다.





\## 40. Observation != Interpretation != Decision



세 층 분리:



Observation

→ 실제 관찰/측정



Interpretation

→ AI/시스템의 해석 제안



Clinical Decision

→ Therapist 결정



AI가 세 번째를 자동 확정하지 않는다.





\# =====================================================================

\# PHASE J — THERAPIST M1

\# =====================================================================



\## 41. Evidence Card



Magic Beam attempt 하나에 대해

치료사가 다음을 확인할 수 있어야 한다.



Target

Activity

Generalization level

Attempt

Cue

Independence

Duration

Frication/acoustic evidence

Audio quality

AI confidence

Provenance

Verification state



그리고:



Confirm

Correct

Reject



버튼이 실제 backend에 반영되어야 한다.





\## 42. Therapist correction



AI original result 삭제 금지.



예:



AI:

possible substitution



Therapist:

distortion으로 수정



→ original AI observation 유지

→ clinician correction 별도 저장

→ audit 기록





\## 43. Session Timeline



세션 중 발생한 observation을

시간순으로 본다.



Game event

→ Clinical evidence



를 drill-down 가능하게 한다.





\## 44. Real-time verification



현재 Rev.6 plan의 현실적인 workflow를 유지한다.



가능하면 진행 중 세션을 약 3초 단위로 refresh/poll해서

치료사가 옆에서 evidence를 빠르게 확인할 수 있게 한다.



WebSocket이 반드시 필요한 것은 아니다.



불필요하게 architecture를 복잡하게 만들지 않는다.





\## 45. Quick verification



높은 confidence + good audio에 대해

치료사의 효율을 높일 수 있는:



quick confirm



keyboard shortcut



batch confirm



등은 plan 범위에서 구현 가능.



단 자동 clinician verification은 금지.





\# =====================================================================

\# PHASE K — M1 ACCEPTANCE TEST

\# =====================================================================



\## 46. M1은 다음을 만족해야 다음 단계로 넘어감



\[ ] V2 branch 분리

\[ ] backend auth

\[ ] STUDENT/THERAPIST/ADMIN role

\[ ] password hash

\[ ] IDOR 기본 차단

\[ ] student login

\[ ] Hoya Home

\[ ] 실제 3D Hoya

\[ ] Magic Beam에서 Hoya 직접 action

\[ ] voice → action

\[ ] uncertain != failure

\[ ] child wait/grace period

\[ ] gentle retry

\[ ] ClinicalObservation

\[ ] Therapist Evidence Card

\[ ] Confirm

\[ ] Correct

\[ ] Reject

\[ ] Session Timeline

\[ ] invalid acoustic input != 500

\[ ] 가능한 automated tests

\[ ] 정확한 status report



M1 미완료인데

M2 COMPLETE라고 선언하지 않는다.





\# =====================================================================

\# PHASE L — M2

\# =====================================================================



\## 47. Character Conversation



구현:



Child Speech

↓

Speech Recognition

↓

Dialogue Understanding

↓

Therapist Goal Context

↓

Safety Policy

↓

Character Response

↓

TTS

↓

Mouth animation



대화는 짧고 아동 친화적인 한국어.



한 번에 질문 하나.



target word를 억지로 반복시키지 않는다.





\## 48. Conversation safety



LLM에게:



filesystem

shell

admin action

arbitrary DB access

arbitrary endpoint execution



권한을 주지 않는다.



민감정보 요청 금지.



의료 진단 금지.



치료사 대체 표현 금지.



API unavailable 시

명확한 DEMO fallback 가능.





\## 49. Mouth animation



TTS audio amplitude를 실제 분석할 수 있으면:



CLOSED

HALF

OPEN



등 mouth state mapping.



browser speechSynthesis 때문에 amplitude access가 불가능하면

documented rhythmic/word-boundary fallback.



가짜 amplitude 분석이라고 주장하지 않는다.





\# =====================================================================

\# PHASE M — 모든 게임에서 HOYA가 직접 행동

\# =====================================================================



\## 50. Sky Climb



아이:



목소리를 지속



↓



Hoya가 직접 날아오름.



VOICE\_START

→ CHARGE



VOICE\_CONTINUE

→ FLY / ASCEND



VOICE\_END

→ slow descent / LAND



speech resume

→ 다시 상승



Game Over 중심 구조 금지.





Clinical purpose:



sustained production / speech continuity observation.





\## 51. Monster Adventure



target production

↓

Hoya 직접:

CHARGE

CAST

ATTACK



HIGH:

strong action



MEDIUM:

small action + supportive cue



LOW/UNCERTAIN:

LISTENING/ENCOURAGE

실패 공격 금지.





Clinical purpose:



word-level target production

phoneme/position/attempt/cue observation.





\## 52. Magic Beam



Hoya 직접:



energy orb

charge

beam

release



목소리 지속에 따라 강도 변화.



Clinical purpose:



sustained production

frication/continuity observation.





\## 53. Conversation Quest



대화 결과가

실제 Hoya 행동으로 이어진다.



예:



호야:

"뭐 가져갈까?"



아이:

"사과"



↓



Hoya walks

picks apple

puts in bag

cheers



Clinical purpose:



prompted/contextual/conversational/generalization observation.





\## 54. Reward



Hoya가:



chest open

star/item receive

dance

accessory equip



등 직접 행동.





\# =====================================================================

\# PHASE N — CLINICAL CONTEXT OF EVERY GAME

\# =====================================================================



\## 55. GameRegistry



각 GameDefinition에 최소:



clinicalPurpose

trainingSkill

observableSignals

supportedPhonemes

supportedGeneralizationLevels

difficulty

parameters

clinicalLimitations



또는 동등 필드.





\## 56. 게임 telemetry를 clinical data로 그대로 보여주지 않는다



예:



beamPower = 87



을 치료사에게:



발음 정확도 87



로 변환하면 안 된다.



ClinicalMeaningMapper가

context를 가진 observation으로 변환한다.





\# =====================================================================

\# PHASE O — CLINICAL DASHBOARD

\# =====================================================================



\## 57. M2 핵심 views



최소 핵심:



Target Phoneme Trend



Phoneme × Word Position



Error Pattern / AI uncertainty



Cue Dependence vs Independent Production



Generalization Ladder



AI Confidence Distribution



현재 plan이 M2 핵심 5개를 지정했다면

그 우선순위를 유지하되 위 clinical semantics를 모두 보존한다.





\## 58. Graph principle



모든 graph는 질문에 답해야 한다.



예:



시간이 지나며 target observation이 어떻게 달라졌는가?



어느 word position에 evidence가 부족한가?



cue 없이 생산되는 비율이 변하는가?



word에서 conversation으로 generalization evidence가 있는가?



AI가 판단에 확신하지 못하는 구간은 어디인가?





\## 59. No Data



반드시:



NO DATA

0

INCORRECT

UNCERTAIN



을 구분한다.



No Data를 0점으로 그래프에 넣지 않는다.





\## 60. sample count



clinical graph에는 가능한 경우:



n



표시.



작은 sample에서 강한 clinical conclusion을 만들지 않는다.





\## 61. Drill-down



Overview

↓

Target

↓

Session

↓

Attempt

↓

Evidence



로 이동 가능.





\# =====================================================================

\# PHASE P — CLINICAL FEATURES

\# =====================================================================



\## 62. 다음 전문 context를 데이터 모델과 dashboard에 연결



Target phoneme



Word position



Error pattern



Consistency



Cue level



Independent production



Generalization level



Response latency



Attempt/retry



AI confidence



Audio quality



Stimulability support



Intelligibility — 별도 입력/판단



PCC — 조건을 충족할 때만





\## 63. PCC



baseline AI 결과를

clinical PCC라고 주장하지 않는다.



구분:



AI-ESTIMATED

CLINICIAN-VERIFIED

NOT AVAILABLE



적절한 sample/transcription이 없으면:



INSUFFICIENT DATA.





\## 64. Intelligibility



pronunciation score와 별개.



치료사/보호자 입력 또는

검증 가능한 별도 자료로 취급.



AI가 severity를 자동 진단하지 않는다.





\# =====================================================================

\# PHASE Q — THERAPIST LOOP

\# =====================================================================



\## 65. 핵심 closed loop



Therapist Goal

↓

Hoya Activity

↓

Speech Sample

↓

Pronunciation / Speech Evidence

↓

ClinicalObservation

↓

Therapist Dashboard

↓

Confirm / Correct / Reject

↓

Therapist Instruction

↓

Next Assignment

↓

Next Hoya Interaction





\## 66. Therapist instruction



자연어 입력이 존재해도

LLM이 치료 계획을 임의 적용하지 않는다.



최종적으로 structured preview를 만든다.



예:



targetPhoneme

position

cue

maxAttempts

priority

pacing



Therapist가:



Accept

Modify

Reject



한 뒤에만 적용.





\## 67. Recommendation



게임 추천에 반드시:



recommended activity

clinical purpose

reason

evidence

confidence



를 표시한다.



예:



Magic Beam



Purpose:

/ㅅ/ sustained production



Reason:

최근 comparable attempts에서 지속 시간이 짧음



Evidence:

session ids



Confidence:

MEDIUM



Therapist:

Accept / Modify / Reject





\# =====================================================================

\# PHASE R — M3 / POLISH

\# =====================================================================



\## 68. M3



M1/M2 핵심이 실제 동작한 뒤:



remaining graphs

remaining Hoya states

accessories

visual polish

performance

docs

manual test plan

competition demo

validation report

PR



순서로 완료.





\## 69. 3D performance



지원 우선:



Desktop Chrome/Edge

Android Chrome



Rev.6 plan의 performance budget을 따른다.



unsupported browser는

기능을 거짓으로 실행하지 않고

명확한 DEMO/fallback 사용.





\# =====================================================================

\# PHASE S — CHILD UI / THERAPIST UI 분리

\# =====================================================================



\## 70. Child UI



보여줘야 하는 것:



Hoya

story

game

reward

friendly retry

choice

break



보이면 안 되는 것:



PCC

clinical severity

error percentage

phonological-process chart

AI confidence graph

medical terminology





\## 71. Therapist UI



전문 terminology 사용 가능.



하지만 tooltip/definition 제공.



치료사가:



무슨 값인지

어디서 왔는지

AI인지 검증값인지



이해할 수 있어야 한다.





\# =====================================================================

\# PHASE T — RESEARCH / DOCUMENTATION

\# =====================================================================



\## 72. Clinical Evidence



`docs/v2/CLINICAL\_EVIDENCE.md`



또는 plan의 최종 동등 문서를 구현.



가능한 research가 있다면:



professional association

peer-reviewed paper

systematic review/evidence map

professional textbook

Korean research

case/single-case study



순으로 조사.



외부 검색을 사용할 수 없으면

citation을 만들어내지 않는다.



그 경우:



RESEARCH\_REQUIRED



로 표시.





\## 73. Korean clinical evidence



한국어 말소리장애/언어재활 자료를

별도 조사 대상으로 유지.



근거 없는 수치를 제품에 넣지 않는다.





\## 74. Clinical Dashboard documentation



각 metric마다:



definition

data source

formula if applicable

provenance

limitation

clinician interpretation

missing-data handling



기록.





\# =====================================================================

\# PHASE U — PRIVACY

\# =====================================================================



\## 75. Raw audio



기존 최종 policy 유지:



RAW AUDIO PERMANENT STORAGE = OFF by default.



현재 real server pronunciation model이 없다면

불필요한 server raw-audio upload path를 억지로 구현하지 않는다.



architecture interface/document만 유지 가능.



향후 transient server inference:



HTTPS upload

→ in-memory inference

→ immediate discard



구조를 허용하되

현재 필요하지 않으면 attack surface를 늘리지 않는다.





\## 76. 로그



로그 금지:



password

token

raw child audio

secret

불필요한 전체 민감 대화





\# =====================================================================

\# PHASE V — AUDIT

\# =====================================================================



\## 77. Audit events



최소:



LOGIN\_SUCCESS

LOGIN\_FAILURE

LOGOUT

ACCESS\_DENIED

ROLE\_ACCESS\_DENIED

THERAPIST\_CONFIRM

THERAPIST\_CORRECT

THERAPIST\_REJECT

GOAL\_UPDATED

RECOMMENDATION\_ACCEPTED

RECOMMENDATION\_MODIFIED

RECOMMENDATION\_REJECTED



필요한 이벤트를 현재 schema와 맞춰 구현.



actor/action/resource/timestamp/result 중심.



민감 데이터 저장 금지.





\# =====================================================================

\# PHASE W — TEST MATRIX

\# =====================================================================



\## 78. Security tests



student correct login



wrong password



student + admin checkbox



student → admin



therapist → admin



Student A → Student B



Therapist A → unassigned child



expired session



logout



invalid session



missing auth



invalid role



direct URL ID modification



malformed payload



oversized payload





\## 79. Speech tests



sustain valid



short speech



gap tolerance



clipping



poor audio



frication



same analysis window



invalid acoustic type



uncertain



two retries



neutral continue





\## 80. Child pacing tests



pause during utterance

→ not interrupted



slow response

→ no premature retry



speech end

→ grace period



LOW

→ wait + gentle retry



UNCERTAIN

→ no failure



maxAttempts

→ neutral transition





\## 81. Clinical tests



game event

→ ClinicalObservation



phoneme context preserved



word position preserved



attempt preserved



cue preserved



independence preserved



response latency preserved



confidence provenance



AI estimate != therapist verified



Confirm



Correct with original retained



Reject



No Data != zero



different generalization levels not incorrectly merged



different cue conditions distinguishable





\## 82. Game tests



Magic Beam:

voice → Hoya charge/beam



Sky Climb:

voice → Hoya fly



Monster:

target → Hoya attack



Conversation Quest:

recognized/selected response → Hoya action



UNCERTAIN:

no failure action





\# =====================================================================

\# PHASE X — FINAL VALIDATION

\# =====================================================================



\## 83. 반드시 시도할 명령



Backend:



backend\\.venv\\Scripts\\python.exe -m pytest backend -q



Frontend:



npm.cmd run typecheck

npm.cmd test

npm.cmd run build



Repository:



git diff --check



Security/API smoke:

현재 project script 또는 direct test를 사용.



Audit:



npm.cmd audit --json





\## 84. 테스트 결과 거짓 보고 금지



상태는 반드시 다음 중 하나로 표시:



IMPLEMENTED AND TESTED



IMPLEMENTED BUT NOT MANUALLY VERIFIED



IMPLEMENTED BUT AUTOMATED TEST BLOCKED



DEMO / BASELINE



NOT IMPLEMENTED



BLOCKED





\## 85. Physical microphone



실제 물리 microphone으로 직접 검증하지 않았다면:



NOT MANUALLY VERIFIED



라고 기록.



절대 PASS라고 만들지 않는다.





\## 86. Pronunciation accuracy



labeled evaluation dataset 없이:



95% 정확도

clinical-grade

치료 효과



같은 숫자/주장 금지.



표현:



BASELINE

NOT VALIDATED — NO LABELED DATA



사용.





\# =====================================================================

\# PHASE Y — FINAL DEMO

\# =====================================================================



\## 87. Competition demo



최종 3분 demo가 최소 다음 story를 보여야 한다.



1\. Student login

2\. Hoya Character Home

3\. Hoya greeting

4\. Hoya conversation

5\. child target utterance

6\. mouth/TTS reaction

7\. recommended activity

8\. Magic Beam / Sky Climb / Monster 중 speech-driven Hoya action

9\. ClinicalObservation 생성

10\. Therapist login

11\. evidence 확인

12\. Confirm 또는 Correct

13\. graph/timeline 반영

14\. 다음 activity recommendation/adaptation





\## 88. 마이크 없는 시연



Rev.6의:



reset-demo

deterministic demo flow



또는 동등 기능 유지.



DEMO 데이터는

실제 clinical measurement라고 오인되지 않도록

명시적으로 DEMO 표시.





\# =====================================================================

\# PHASE Z — GIT / COMMITS / PR

\# =====================================================================



\## 89. logical commits



가능한 논리적 commit 단위 예:



fix: validate acoustic summaries and retry states



feat: add secure role based authentication



feat: add shared 3d hoya companion



feat: connect speech signals to hoya actions



feat: add clinical observation evidence flow



feat: add therapist evidence verification



feat: add conversational hoya experience



feat: upgrade adaptive speech games



feat: add clinical dashboard and recommendations



test: add v2 security and clinical coverage



docs: add v2 validation and clinical evidence





\## 90. PR



최종 branch:



feature/speech-hero-v2-tiger



MVP PR #1을 오염시키지 않는다.



가능하면 push + V2 PR 생성.



불가능하면 정확한 blocker와

사용자가 실행할 명령 제공.



PR URL을 만들지 못했는데

가짜 URL을 쓰지 않는다.





\# =====================================================================

\# FINAL REVIEW CONTRACT

\# =====================================================================



\## 91. 다음 review에서는 plan 문구가 아니라 실제 코드 기준으로 판단



Claude는 다음 review에서:



파일 존재

implementation

API behavior

route guards

tests

build

Git branch

diff



를 실제로 검사한다.



"plan에 적혀 있다"



는 구현 완료 증거가 아니다.





\## 92. Requirement Status Matrix



최종 review.md에 최소:



Requirement

Status

Evidence/File

Test

Limitation



표를 만든다.



Status:



PASS

PARTIAL

FAIL

BLOCKED

NOT VERIFIED





\## 93. M1/M2/M3 별도 판정



최종 보고:



M1: PASS/PARTIAL/FAIL

M2: PASS/PARTIAL/FAIL

M3: PASS/PARTIAL/FAIL



각각 근거를 적는다.



M1 실패인데:



READY



판정 금지.





\## 94. READY 판정



READY는 다음이 충족될 때만:



\- critical/security blocker 없음

\- M1 PASS

\- core M2 demo path 실제 동작

\- 테스트 가능한 범위 PASS

\- unverified 항목 명확히 표시

\- no secret

\- correct V2 branch

\- documentation truthful



그 외:



NOT READY



또는:



DEMO READY / NOT CLINICALLY VALIDATED



처럼 정확히 구분.





\# =====================================================================

\# FINAL NON-NEGOTIABLE PRINCIPLES

\# =====================================================================



\## 95. Child



아이에게는:



게임

호야

대화

모험

보상

친근한 기다림



으로 느껴져야 한다.





\## 96. Therapist



언어치료사에게는

같은 하나하나의 interaction이:



target

phoneme

position

context

attempt

cue

independence

generalization

latency

duration

AI uncertainty

provenance



를 가진

의미 있는 관찰 자료로 보여야 한다.





\## 97. AI



AI의 역할:



observe

estimate

organize

explain uncertainty

recommend



까지.





\## 98. Clinician



최종:



interpretation

verification

goal

treatment decision



은 Therapist가 한다.





\## 99. Core architecture



PLAY

↓

CHILD SPEECH

↓

HOYA ACTION

↓

STRUCTURED CLINICAL OBSERVATION

↓

THERAPIST EVIDENCE

↓

THERAPIST DECISION

↓

NEXT GOAL

↓

NEXT PLAY





\## 100. 가장 중요한 실행 지시



이번 요청을:



"review 문서 수정 요청"



으로 해석하지 마라.



이 요청은:



"현재 review에서 확인된 미완성 production implementation을

실제 execute 단계로 되돌려 수정하고 계속 구현하라"



는 요청이다.



현재 결과를 승인하지 않는다.



review → execute QA loop를 사용해

Codex에게 실제 구현을 수행하게 하라.



구현 후:



Claude가 다시 검토한다.



코드가 없는데 문서만 COMPLETE로 만들지 않는다.



테스트하지 않았는데 PASS라고 쓰지 않는다.



계획만 존재하는 기능을 IMPLEMENTED라고 쓰지 않는다.



token/time 제약으로 전체가 끝나지 않으면

정확히 어디까지 구현했는지를 보고하고

미완성 상태를 숨기지 않는다.





END FINAL REMEDIATION SPEC
