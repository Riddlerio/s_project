Rev.2 최종 보완 결정이다.



이 메시지는 이전에 잘려 전달된 G2/G3/G5와 Git 상태,

Raw Audio 정책, 그리고 모든 게임에서 호야가 직접 행동하는

Character-First Game Architecture를 한 번에 확정하기 위한 것이다.



기존 plan에서 이미 정상적으로 반영된 G1/G4 및 다른 요구사항은 유지한다.



이 메시지의 결정은 기존 plan의 충돌하는 기본값보다 우선한다.



==================================================

0\. GIT FETCH 문제 해결 완료

==================================================



사용자가 별도 PowerShell에서 직접 다음을 완료했다.



git fetch origin



결과:



origin/main:

8d882f3 -> 9fe574f 로 최신화 완료



remote branches:



origin/feature/speech-hero-mvp

origin/main



캐릭터 reference 확인:



origin/main에



20190610.010190759320001i1.jpg



존재 확인.



현재 MVP HEAD:



69942b3

chore: review and harden frontend dependencies



현재 local HEAD:



feature/speech-hero-mvp



따라서 plan에서:



"git fetch를 하지 못했다"

"최신 origin/main 상태를 확인하지 못했다"



라는 blocker는 제거한다.





PR #1이 아직 main에 merge되지 않았다면:



origin/feature/speech-hero-mvp



를 V2 구현의 코드 기반으로 사용한다.



새 branch:



feature/speech-hero-v2-tiger



를 만든다.





캐릭터 reference 이미지는:



origin/main의



20190610.010190759320001i1.jpg



파일만 안전하게 가져온다.



main 전체 merge는 하지 않는다.



기존 MVP 변경사항을 잃으면 안 된다.





==================================================

1\. G2 — HOYA 3D CHARACTER

==================================================



Speech Hero V2의 핵심 캐릭터는 "호야"이다.



Reference:



20190610.010190759320001i1.jpg





해당 이미지를 공식 visual reference로 사용한다.



주요 특징:



\- 흰색 호랑이

\- 검정/회색 줄무늬

\- 둥근 큰 머리

\- 짤막한 몸

\- 짧은 팔과 다리

\- 귀여운 비율

\- 친근한 얼굴

\- 청록/초록 계열 장식

\- cape 느낌

\- reference의 전반적인 정체성 유지





단순 JPG 이미지를 화면 중앙에 배치하고

3D 캐릭터라고 주장하면 안 된다.





실제:



Stylized 3D Hoya



를 구현한다.





우선 기술 방향:



React Three Fiber

\+

Three.js





procedural 3D model로 구현 가능하다.





예:



Head

→ rounded sphere



Body

→ rounded capsule



Arms / Legs

→ capsules



Ears

→ rounded geometry



Eyes

→ simple toon mesh



Mouth

→ separate animated mesh



Stripe

→ simple geometry / material



Cape / scarf

→ lightweight geometry





전문 3D asset이 없어도

공모전 prototype에서 충분히 3D 느낌이 나야 한다.





향후 전문 GLB / GLTF 모델로 교체 가능하도록:



TigerAvatarProvider



또는 이에 준하는 abstraction을 둔다.





==================================================

2\. HOYA CHARACTER STATES

==================================================



최소 animation/state:



IDLE



BLINK



LISTENING



THINKING



TALKING



HAPPY



CHEER



ENCOURAGE



SURPRISED



RUN



JUMP



FLOAT



FLY



LAND



CHARGE



CAST



ATTACK



BEAM



TREASURE\_FOUND



GAME\_SUCCESS



GAME\_RETRY





Character Home / Conversation / Game에서

같은 Hoya character state system을 공유한다.





==================================================

3\. TALKING MOUTH ANIMATION

==================================================



호야가 대답할 때 실제로 입이 움직여야 한다.





1차 구현은 완전한 viseme lip-sync를 요구하지 않는다.





구조:



TTS START



↓



TALKING state



↓



Web Audio Analyser

또는

TTS playback amplitude



↓



MOUTH\_CLOSED

MOUTH\_HALF

MOUTH\_OPEN



↓



TTS END



↓



IDLE





Audio analyser를 사용할 수 없는 경우에는:



TALKING 상태 동안

자연스러운 rhythmic mouth movement



fallback을 사용할 수 있다.





단:



TALKING 상태가 아닐 때

입이 계속 움직여서는 안 된다.





향후:



phoneme / viseme based lip-sync



로 확장할 수 있도록 설계한다.





==================================================

4\. PRODUCT CENTER = HOYA

==================================================



Speech Hero V2의 중심은 게임 메뉴가 아니다.



중심은:



Hoya Companion



이다.





아이의 경험:



Login



↓



Character Home



↓



호야



↓



대화 / 모험 / 게임



↓



보상



↓



호야 성장





앱을 켜는 느낌은:



"발음 훈련해야지"



보다:



"호야랑 이야기하고 놀아야지"



여야 한다.





훈련은 이 경험 안에 자연스럽게 숨긴다.





==================================================

5\. CHARACTER HOME

==================================================



로그인 후 바로 복잡한 dashboard로 보내지 않는다.



Character Home으로 이동한다.





예:



\--------------------------------

Lv. 8       오늘의 미션      ★

\--------------------------------





&#x20;            3D HOYA





&#x20;       "오늘 뭐하고 놀까?"





&#x20;   이야기하기      모험가기



&#x20;   연습하기        보물함

\--------------------------------





호야를 터치하면:



\- 눈 깜빡임

\- 고개 움직임

\- 손 흔들기

\- 표정 변화

\- 작은 reaction



등이 발생한다.





==================================================

6\. CLEAN CONVERSATION SCREEN

==================================================



사용자의 명확한 요구:



"호야와 대화할 때 배경은 깔끔하게"





대화 화면은 게임 화면보다 훨씬 minimal하게 만든다.





사용:



\- clean light background

\- subtle gradient

\- soft ambient glow

\- 충분한 whitespace

\- 중앙 Hoya

\- speech bubble 하나

\- microphone control

\- 작은 상태 indicator





상태:



LISTENING



THINKING



SPEAKING





정도만 보여준다.





금지:



복잡한 game HUD



phoneme score



clinical terminology



복잡한 chart



과도한 background object



과도한 particle





아이의 시선이:



호야 얼굴

\+

대화



에 집중되게 한다.





==================================================

7\. G3 — LOGIN

==================================================



첫 화면:



학번



비밀번호



\[ ] 관리자 로그인



로그인 버튼





구조를 사용한다.





중요:



이 비밀번호는 실제 대학 포털 비밀번호가 아니다.



Speech Hero 전용 credential이다.





실제 대학 인증과 향후 연동할 경우에는:



SSO



OIDC



OAuth



SAML



등 학교가 승인한 공식 인증만 사용한다.





절대 구현하지 않는다:



학교 포털 password scraping



학교 포털 password proxy



실제 학교 password 저장





==================================================

8\. ADMIN LOGIN CHECKBOX SECURITY

==================================================



관리자 로그인 checkbox는:



UI login intent



일 뿐이다.





절대:



if adminChecked:

&#x20;   role = ADMIN



같은 구조를 사용하지 않는다.





Backend DB의 실제 account role:



STUDENT



THERAPIST



ADMIN



을 기준으로 권한을 결정한다.





예:



STUDENT credential



\+



admin checkbox true



↓



ADMIN session 발급 금지



↓



403 또는 login denied





Backend가 role을 강제한다.





==================================================

9\. RBAC

==================================================



Frontend route hiding은 보안이 아니다.



모든 권한은 Backend에서 검증한다.





필수 abstraction:



require\_authenticated\_user



require\_student



require\_therapist



require\_admin



require\_child\_access



또는 동등한 구조.





필수 방어:



Student A

→ Student B 데이터 접근 금지





Therapist A

→ 배정되지 않은 Student 접근 금지





STUDENT

→ /admin 금지





THERAPIST

→ admin user management 금지





URL의 id를 직접 변경해도

다른 사용자 데이터 접근 금지.





즉:



IDOR protection



필수.





==================================================

10\. PASSWORD / SESSION SECURITY

==================================================



Password plaintext 저장 절대 금지.





권장:



Argon2id



또는 동등한 안전한 password hashing.





DB:



password\_hash만 저장.





API response / logs:



password



password\_hash



token



노출 금지.





가능하면 V2 auth는:



HttpOnly cookie



Production Secure



SameSite



Session expiration



Logout invalidation



Backend role validation



을 사용한다.





Cookie auth 사용 시:



CSRF protection



Origin validation



도 함께 구현한다.





Login endpoint:



rate limiting



repeated failure protection



generic login error



account enumeration prevention





사용자에게:



"해당 학번은 없습니다"



대신:



"로그인 정보를 확인해주세요."



같은 메시지를 사용한다.





==================================================

11\. ADMIN SPACE

==================================================



ADMIN 전용:



/admin



/admin/users



/admin/students



/admin/therapists



/admin/assignments



/admin/audit





ADMIN만:



account management



role management



assignment management



audit access



가능하다.





THERAPIST는 관리자 account/role 관리 기능에 접근할 수 없다.





==================================================

12\. G5 — CHARACTER FIRST EXPERIENCE

==================================================



Speech Hero V2의 핵심 UX:



Character First.





전체 Child Flow:



Login



↓



Character Home



↓



호야와 대화



↓



자연스러운 발화



↓



Pronunciation Analysis



↓



Adaptive Activity / Game



↓



호야 Action



↓



Reward



↓



호야 progression





대화와 게임이 분리된 앱처럼 느껴져서는 안 된다.





호야라는 하나의 캐릭터와:



대화하고



모험하고



게임하고



성장한다.





==================================================

13\. CHARACTER CONVERSATION

==================================================



호야는 단순 Text Chat UI가 아니다.





Pipeline:



Child Voice



↓



Audio Quality / VAD



↓



Speech Recognition



↓



Dialogue Understanding



↓



Therapist Goal Context



↓



Target Word Strategy



↓



Child Safety



↓



Hoya Response



↓



TTS



↓



Hoya Mouth Animation





필요 abstraction:



CharacterDialogueProvider



ConversationService



ConversationMemoryStore



TargetWordInjector



DialogueSafetyPolicy



TherapistGoalContextProvider



TTSProvider



MouthAnimationController





대화 응답:



\- 짧고 쉬움

\- 어린이 친화적

\- 자연스러운 한국어

\- 한 번에 질문 하나

\- target word 억지 삽입 금지





예:



훈련 목표:

/ㅅ/





호야:



"피크닉 갈 건데 과일 하나 챙기자!

사과랑 바나나 중에 뭐가 좋을까?"





아이:



"사과"





아이는 대화를 하고 있다고 느낀다.



Pronunciation Engine은 background에서 평가한다.





==================================================

14\. CHARACTER DIALOGUE SAFETY

==================================================



호야 AI는:



의료 진단 금지



치료사 역할 금지



주소 요구 금지



전화번호 요구 금지



비밀번호 요구 금지



과도한 개인정보 요구 금지



감정적 의존 유도 금지



"나만 믿어"



같은 표현 금지



위험 행동 조언 금지





LLM에는:



filesystem



shell



database admin



arbitrary tools



권한을 제공하지 않는다.





LLM output은 화면에 표시하기 전

server-side safety policy를 통과한다.





==================================================

15\. SPEECH IS THE CONTROLLER

==================================================



Speech Hero V2의 가장 중요한 interaction principle:



"Speech is the Controller."





아동의 목소리가 단순히:



정답 여부



를 결정하는 것이 아니라,



호야의 실제 행동



을 만들어야 한다.





공통 구조:



Speech Engine



↓



Normalized SpeechGameSignal



↓



GameActionMapper



↓



HoyaActionController



↓



3D Hoya Action





예:



VOICE\_START

→ CHARGE





VOICE\_CONTINUE

→ FLY / BEAM\_POWER





VOICE\_END

→ LAND / RELEASE





TARGET\_SUCCESS

→ ATTACK / CAST





TARGET\_RETRY

→ ENCOURAGE





UNCERTAIN

→ LISTENING





==================================================

16\. SHARED HOYA GAME AVATAR

==================================================



게임마다 다른 캐릭터를 새로 만들지 않는다.





Character Home



Conversation



Sky Climb



Monster Adventure



Magic Beam



Conversation Quest



Reward





모두 같은 Hoya avatar system을 사용한다.





공통:



model



materials



proportions



animation state



cosmetics



character progression





가능하면 게임에서도:



획득한 accessory



를 동일하게 표시한다.





==================================================

17\. SKY CLIMB — HOYA ACTION

==================================================



Sky Climb의 플레이어는 호야다.





기존:



발성

→ 단순 물체 상승





금지.





새 구조:



아이가:



"스────────"



발화 시작



↓



호야 CHARGE



↓



바람 / 빛 particle



↓



호야가 실제로 위로 날아감





지속 발화:



↓



호야 계속 상승



↓



cape / scarf 움직임



↓



particle trail



↓



구름 통과





침묵:



↓



호야 천천히 하강





다시 발화:



↓



호야 다시 상승





즉:



SPEECH ENERGY



→



HOYA VERTICAL MOVEMENT





필수 visual:



\- smooth interpolation

\- cloud parallax

\- particle trail

\- floating objects

\- goal rings

\- soft camera follow

\- character reaction

\- landing animation





즉시 Game Over 구조는 사용하지 않는다.





게임 종료:



호야 목표 지점 착지



↓



CHEER



↓



보물 / 별 획득





==================================================

18\. MONSTER ADVENTURE — HOYA ACTION

==================================================



호야가 직접 전투/마법 액션을 한다.





Target word



↓



Pronunciation Evaluation



↓



Hoya CHARGE



↓



CAST / ATTACK



↓



Monster Reaction



↓



Particles / Impact



↓



Reward





HIGH confidence + success:



강한 마법 공격



screen impact



monster reaction



Hoya HAPPY / CHEER





MEDIUM:



작은 charge



friendly hint



retry





LOW / UNCERTAIN:



공격 실패 처리 금지



Hoya LISTENING



"앗, 내가 잘 못 들었나 봐.

다시 한번 말해줄래?"





AI uncertainty를

아이의 실패로 표현하지 않는다.





==================================================

19\. MAGIC BEAM — HOYA ACTION

==================================================



Magic Beam도 단순 bar 게임이 아니다.





호야가 직접 빔을 쏜다.





READY:



호야가 자세를 잡는다.





발화 시작:



↓



손 / 마법 장치에 energy orb 생성





지속 발화:



↓



orb 증가



↓



Hoya BEAM



↓



beam 길이 / 강도 증가



↓



particles / glow / impact





발화 중단:



↓



beam 자연스럽게 약화





다시 발화:



↓



beam 재강화





필수 visual:



Hoya casting pose



charge orb



glow



beam trail



spark particles



impact



light pulse



cape/scarf reaction



facial reaction





아이에게:



"내 목소리로 호야가 빔을 쏜다"



는 느낌이 즉시 전달되어야 한다.





==================================================

20\. /ㅅ/ SUSTAINED SOUND

==================================================



/ㅅ/ /s/는 무성 마찰음이므로

pitch/voicing detection만 사용하면 안 된다.





Magic Beam / Sky Climb에서:



"스────────"



감지를 위해 검토:



RMS / Energy



Noise Floor



High-frequency Energy Ratio



Spectral Centroid



Frication Duration





pitch detection 하나로 지속 발화를 판정하지 않는다.





==================================================

21\. CONVERSATION QUEST — HOYA ACTION

==================================================



Conversation Quest는

텍스트/음성 대화만 이어지는 화면이 아니다.





대화 결과가 실제 Hoya action으로 이어진다.





예:



호야:



"피크닉 가자!

어떤 과일 챙길까?"





아이:



"사과!"





↓



Speech Recognition



↓



Pronunciation Evaluation



↓



Dialogue Understanding



↓



호야가 사과를 발견



↓



사과 쪽으로 걸어감



↓



집음



↓



가방에 넣음



↓



CHEER



↓



Story progression





즉:



Conversation



↓



Voice



↓



Understanding



↓



Hoya Action



↓



Story Progression





==================================================

22\. REWARD = HOYA ACTION

==================================================



게임 완료 화면도 숫자만 보여주지 않는다.





호야가:



보물상자 열기



별 받기



아이템 들기



춤추기



accessory 착용



등의 실제 animation을 수행한다.





Reward와 Character Progression을 연결한다.





==================================================

23\. GAME CAMERA

==================================================



Hoya가 항상 잘 보이도록

camera design을 구분한다.





Character Home:



front / portrait camera





Conversation:



upper-body close-up





Sky Climb:



follow camera





Monster Adventure:



3/4 또는 cinematic side camera





Magic Beam:



3/4 action camera





Reward:



close-up celebration





아동용이므로:



과도한 camera shake



과도한 flash



는 피한다.





==================================================

24\. GAME REGISTRY

==================================================



각 게임을 무질서하게 hard-code하지 않는다.





GameRegistry



GameDefinition



GameRecommendationEngine



을 사용한다.





TrainingSkill:



PHONEME\_ACCURACY



SUSTAIN



REPETITION



RHYTHM



WORD\_PRODUCTION



SENTENCE\_PRODUCTION



SPONTANEOUS\_SPEECH





GameDefinition:



id



name



trainingSkills



supportedPhonemes



supportedLevels



interactionType



difficultyRange



parameters





==================================================

25\. ADAPTIVE GAME RECOMMENDATION

==================================================



입력:



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





예:



지속 발화가 짧음



→ Sky Climb





/ㅅ/ 단어 accuracy 문제



→ Monster Adventure





반복 발화 거부



→ Conversation Quest





sustain 훈련



→ Magic Beam





Therapist:



Accept



Modify



Reject





==================================================

26\. THERAPIST = CLINICAL SUPERVISOR

==================================================



치료사는 단순 Dashboard Viewer가 아니다.





Therapist Studio에서:



학생 상태



목표



음소 경향



Pronunciation confidence



최근 세션



게임 수행



게임 추천



AI Recommendation



Therapist Instruction



을 확인한다.





==================================================

27\. THERAPIST NATURAL LANGUAGE ADVICE

==================================================



예:



"이번 주는 /ㅅ/ 어두 단어를 집중하고,

두 번 어려워하면 시각 힌트를 먼저 주세요.

세 번 이상 반복하지 마세요."





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



Preview





↓



Accept / Modify / Reject





승인 전에는:



TrainingGoal



TrainingAssignment



GameRecommendation



에 적용하지 않는다.





==================================================

28\. CONTENT / QUESTION GENERATION

==================================================



치료사의 목표에 따라

문제/단어/대화 target을 추천할 수 있다.





예:



/ㅅ/ 어두



→



사과

사자

소리

수박

시계





하지만 LLM 출력을 그대로 사용하지 않는다.





ContentValidator:



\- 목표 음소 포함 확인

\- 목표 위치 확인

\- 중복 확인

\- 난이도 확인

\- 아동 적합 어휘

\- 부적절 콘텐츠

\- blacklist / exclusion



검사.





가능하면:



validated Korean word bank



를 source of truth로 사용한다.





==================================================

29\. PRONUNCIATION ENGINE

==================================================



Pronunciation accuracy는 P0이다.





일반 ASR과 Pronunciation Assessment를

반드시 분리한다.





SpeechRecognizer:



"무엇을 말했는가"





PronunciationEvaluator:



"어떻게 발음했는가"





DialogueEngine:



"무슨 의미인가"





공통 result:



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





LOW / UNCERTAIN:



FAILURE 처리 금지.





AI가 못 알아들은 상황과

아이가 틀린 상황을 구분한다.





==================================================

30\. REAL / BASELINE / MOCK

==================================================



가짜 결과를 실제 정밀 AI로 표현하지 않는다.





Provider:



RealPronunciationProvider



BaselinePronunciationProvider



MockPronunciationProvider





실제 acoustic model이 아직 없다면:



Baseline



DEMO



라고 정확히 표시한다.





기존 Web Speech transcript score를:



"정밀 발음 정확도"



라고 표시하지 않는다.





==================================================

31\. RAW AUDIO POLICY

==================================================



기존:



"Raw Audio를 서버에 절대 보내지 않는다"



를 절대 제약으로 만들지 않는다.





기본 원칙:



RAW AUDIO PERMANENT STORAGE = OFF





현재 baseline이 browser에서 가능하면

browser에서 처리한다.





하지만 향후:



wav2vec2



HuBERT



WavLM



XLS-R



Forced Alignment



GOP



phoneme classifier



등의 server-side Pronunciation Inference가 필요하면:





Browser



↓



HTTPS encrypted transient upload



↓



Server memory



↓



Pronunciation inference



↓



Result



↓



Raw audio immediate discard





구조를 허용한다.





별도 명시적 consent 없이:



DB 저장 금지



파일 저장 금지



training dataset 수집 금지



장기 보관 금지





즉:



"서버 전송 금지"



가 아니라:



"최소 처리 + 영구 저장 금지 + 즉시 폐기"



가 원칙이다.





==================================================

32\. DATASET / MODEL RESEARCH

==================================================



실행 단계에서도 가능한 범위에서 조사한다.





후보:



AI-Hub Korean child speech



K-Univ Pathological-child-voice



Korean child articulation dataset



Korean speech sound disorder research



APAC



K-APP





반드시 기록:



source



age



hours



speaker count



utterance type



transcript



phoneme label



error annotation



license



commercial use



derivative-model permission



privacy



ASR suitability



pronunciation suitability





확인 안 된 것은:



RESEARCH\_REQUIRED



UNKNOWN



OWNER\_PERMISSION\_REQUIRED



등으로 표시한다.





라이선스 검증 전:



자동 다운로드 금지



자동 학습 금지





==================================================

33\. MODEL ROADMAP

==================================================



Stage 0:



Current ASR baseline





Stage 1:



Forced Alignment / GOP





Stage 2:



SSL acoustic representation





Stage 3:



Child speech adaptation





Stage 4:



Speech-sound-disorder adaptation





Stage 5:



Therapist feedback calibration





실제 labeled data 없이

정확도 수치를 주장하지 않는다.





==================================================

34\. MODERN FRONTEND

==================================================



Child UI:



2026 modern kids mobile application





금지:



구식 Bootstrap UI



plain HTML form feeling



table-heavy child screen



hospital software 느낌





사용:



rounded geometry



soft depth



large touch targets



gradient lighting



micro interaction



smooth transition



modern typography



responsive layout



high-quality spacing





Conversation Screen은

다른 Child 화면보다 더 clean하게 유지한다.





Therapist/Admin UI:



Professional



Calm



Structured



Readable





==================================================

35\. GAME QUALITY

==================================================



기존 단순 HTML/CSS mini-game 수준을 벗어난다.





게임에는 가능한 범위에서:



3D Hoya action



particles



parallax



glow



lighting



smooth animation



transition



sound feedback



camera behavior



reward feedback



character reaction



을 적용한다.





단순히 CSS를 조금 예쁘게 바꾸고

"게임 품질 개선 완료"



라고 하지 않는다.





==================================================

36\. PROGRESSION

==================================================



Hoya progression:



XP



Level



Bond



Items



Cosmetics



Achievements





발음 정확도만으로 성장시키지 않는다.





XP source:



participation



attempt



retry



conversation



game completion



mission completion





발음이 어려운 사용자가

캐릭터 성장에서도 불리해지지 않게 한다.





==================================================

37\. SECURITY THROUGHOUT IMPLEMENTATION

==================================================



보안은 마지막 Phase에 붙이지 않는다.





각 구현 단계마다:



authentication



authorization



privacy



input validation



secret handling



logging



을 함께 처리한다.





절대 Git commit 금지:



.env



API key



LLM key



auth secret



private token





Frontend bundle에 server secret가 포함되지 않도록 한다.





==================================================

38\. SECURITY TESTS

==================================================



필수 자동 테스트:



STUDENT credentials

\+

admin checkbox

→ ADMIN 권한 획득 불가





STUDENT

→ /admin denied





THERAPIST

→ admin account/role management denied





Student A

→ Student B record denied





Therapist A

→ unassigned student denied





No auth

→ protected endpoint 401





Expired/invalid session

→ denied





Wrong password

→ generic error





Password

→ plaintext DB 저장 금지





API response

→ password\_hash 없음





Tracked files

→ secret 없음





==================================================

39\. CHARACTER / GAME TESTS

==================================================



최소 테스트:



Hoya state transition



TALKING mouth animation state



LISTENING state



Conversation state



SpeechGameSignal mapping



GameActionMapper



UNCERTAIN → no failure



Sky Climb movement state



Monster Adventure attack mapping



Magic Beam sustain logic



Conversation Quest action



Game Recommendation



Reward progression





==================================================

40\. PHYSICAL / MANUAL VALIDATION

==================================================



실제 physical microphone을

agent가 검증할 수 없다면:



PASS라고 주장하지 않는다.





문서:



NOT MANUALLY VERIFIED





로 남긴다.





Manual checklist 작성:



microphone allow



permission denied



no speech



background noise



short speech



long speech



/s/ sustained speech



target word



wrong word



uncertain recognition



TTS



mouth movement



Sky Climb



Magic Beam



dashboard update





==================================================

41\. COMPETITION DEMO

==================================================



공모전 3분 시연 flow가 실제 앱에서 자연스럽게 이어져야 한다.





STUDENT:



Login



↓



Character Home



↓



3D Hoya



↓



Voice Conversation



↓



LISTENING



↓



Child speech



↓



THINKING



↓



TTS response



↓



Mouth Animation



↓



Natural target-word elicitation



↓



Pronunciation Evaluation



↓



Game Recommendation



↓



Voice controls Hoya



↓



Reward





THERAPIST:



Login



↓



Student Profile



↓



Pronunciation Profile



↓



Natural-language Advice



↓



Structured Preview



↓



Accept / Modify



↓



Game Recommendation / Assignment





ADMIN:



Admin Login checkbox



↓



Backend actual ADMIN verification



↓



Admin Space





==================================================

42\. COMPETITION TECHNICAL MESSAGE

==================================================



공모전에서 다음이 명확하게 보여야 한다.



1\. 3D Conversational Tiger Companion



2\. Voice Conversation + Mouth Animation



3\. Pronunciation Intelligence



4\. Speech-controlled Character Action



5\. Adaptive Game Recommendation



6\. Therapist Human-in-the-loop



7\. Secure Role-Based Platform





특히 핵심 문장:



"Speech is the Controller."





말한다

→ 호야가 반응한다





발음한다

→ 호야가 마법을 사용한다





길게 발성한다

→ 호야가 날아오르거나 빔을 강화한다





대화한다

→ 호야가 이야기 속 행동을 한다





==================================================

43\. DEVELOPMENT / ORCA SAFETY

==================================================



기존에 정상화된 Orca / Codex 환경을 건드리지 않는다.





수정 금지:



C:\\Users\\kor02\\.orca\\agent-hooks



C:\\Users\\kor02\\AppData\\Roaming\\orca\\codex-runtime-home



hooks.json



codex-hook.cmd



claude-hook.cmd



Orca CLI source





기존 Orca timeout local modification도

되돌리지 않는다.





금지:



npm audit fix --force



git reset --hard



git clean -fd



main 직접 push



사용자 uncommitted 작업 삭제





==================================================

44\. V2 BRANCH

==================================================



구현 branch:



feature/speech-hero-v2-tiger





기반:



origin/feature/speech-hero-mvp



현재 MVP latest:



69942b3





reference asset:



origin/main:



20190610.010190759320001i1.jpg





main 전체 merge 금지.





==================================================

45\. ACCEPTANCE CRITERIA에 추가

==================================================



기존 Acceptance Criteria에

아래를 반드시 포함한다.





A. Hoya가 Character Home의 실제 중심이다.



B. Hoya는 Conversation에서 LISTENING / TALKING 상태를 가진다.



C. TTS 중 mouth animation이 실제로 동작한다.



D. Conversation background가 clean/minimal하다.



E. 동일한 Hoya model/state가 모든 주요 게임에 사용된다.



F. Sky Climb에서 speech가 Hoya movement를 제어한다.



G. Monster Adventure에서 pronunciation event가 Hoya attack을 발생시킨다.



H. Magic Beam에서 sustained speech가 Hoya beam을 제어한다.



I. Conversation Quest에서 대화 결과가 Hoya의 실제 action으로 이어진다.



J. UNCERTAIN은 Hoya failure animation을 만들지 않는다.



K. Student가 admin checkbox를 조작해도 관리자 권한을 얻지 못한다.



L. Backend RBAC / IDOR protection이 automated test로 검증된다.



M. Raw audio는 explicit storage consent 없이는 영구 저장되지 않는다.



N. 실제 acoustic model이 없으면 baseline/demo임을 명확히 표시한다.



O. 실제 microphone 검증이 없으면 PASS라고 주장하지 않는다.



P. Game UI가 기존 단순 HTML mini-game 수준을 넘어선다.



Q. Child UX 전체가 Character First 원칙을 유지한다.





==================================================

46\. PLAN UPDATE INSTRUCTION

==================================================



위 결정을 현재 `.orca/tasks/4/plan.md`에

Rev.3 최종 사용자 결정으로 반영하라.





특히 업데이트 대상:



Product Vision



User Flow



Tiger 3D System



Character Dialogue



Game System



Game Recommendation



Pronunciation Engine



Security Architecture



Auth / RBAC



Privacy / Audio



Implementation Phases



Acceptance Criteria



Risk Register



Files



Final Claude Review Checklist





기존에 정상 반영된 G1/G4는 유지한다.





이 메시지를 반영한 뒤

다시 Plan Gate로 돌아와라.





아직 production code를 구현하지 마라.



Codex 구현은 사용자가 Gate에서 continue를 승인한 뒤 시작한다.
