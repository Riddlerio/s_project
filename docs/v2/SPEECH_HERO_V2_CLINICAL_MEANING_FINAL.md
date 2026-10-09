\# ============================================================

\# SPEECH HERO V2

\# FINAL CLINICAL MEANING LAYER — REV.5

\# ============================================================



이 문서는 Speech Hero V2의 최종 사용자 결정이다.



기존:



SPEECH\_HERO\_V2\_TASK.md

SPEECH\_HERO\_V2\_DECISIONS.md

SPEECH\_HERO\_V2\_CLINICAL\_ADDENDUM.md

.orca/tasks/4/plan.md



의 모든 핵심 방향을 유지한다.



이번 Rev.5의 가장 중요한 목표는 하나이다.





==================================================

CORE PRINCIPLE

==================================================



아이에게는:



"호야와 놀고 이야기하는 게임"



이어야 한다.





하지만 언어치료사가 같은 세션을 볼 때는:



"아동의 말소리 산출, 반응, cue 사용,

독립성, 일반화, 반복 특성, 자신감이 아니라 AI confidence,

시간 변화, 오류 패턴 등을 볼 수 있는

언어치료적 관찰 자료"



로 해석될 수 있어야 한다.





즉:



CHILD EXPERIENCE

=

PLAY





THERAPIST EXPERIENCE

=

CLINICALLY MEANINGFUL EVIDENCE





아이에게 보이는 모든 주요 게임 행동에는

가능한 경우 언어치료적인 의미가 연결되어야 한다.





그러나:



AI가 진단하지 않는다.



게임 점수가 장애 정도를 뜻하지 않는다.



AI score가 임상 평가를 대체하지 않는다.



최종 해석과 치료 결정은

언어재활사/언어치료사가 한다.





\# ============================================================

\# 1. DUAL-LAYER EVENT MODEL

\# ============================================================



모든 주요 게임 event를:



Game Event



와



Clinical Observation



두 층으로 설계한다.





예:



아이가 /ㅅ/를 길게 발음한다.



CHILD SIDE:



호야가 하늘로 날아간다.





THERAPIST SIDE:



Target:

ㅅ



Task:

sustained production



Duration:

2.8 sec



Attempt:

2



Cue:

NONE



Independence:

INDEPENDENT



Audio quality:

GOOD



AI confidence:

HIGH



Session context:

Sky Climb



Previous comparable attempt:

2.2 sec



Change:

+0.6 sec





이 두 정보는

같은 underlying event에서 생성되어야 한다.





\# ============================================================

\# 2. CLINICAL EVENT PIPELINE

\# ============================================================



공통 architecture를 추가한다.





Child Voice / Action



↓



Game Interaction



↓



SpeechGameSignal



↓



HoyaAction



\+



ClinicalObservationBuilder



↓



ClinicalObservation



↓



Session Evidence Store



↓



Therapist Dashboard





즉 게임이 analytics를 나중에 억지로 붙이는 구조가 아니라,



처음부터:



GAMEPLAY EVENT

=

POTENTIAL THERAPY EVIDENCE



라는 구조로 만든다.





\# ============================================================

\# 3. CLINICAL OBSERVATION SCHEMA

\# ============================================================



공통 ClinicalObservation schema를 설계한다.





예:



observationId



studentId



sessionId



timestamp



activityType



gameId



targetLevel



targetPhoneme



targetWord



wordPosition



expectedPhones



observedPhones



attemptNumber



maxAttempts



responseLatencyMs



speechDurationMs



sustainDurationMs



cueType



cueLevel



cueProvidedBeforeAttempt



independenceLevel



pronunciationResult



aiConfidence



audioQuality



errorPattern



successState



retryReason



generalizationLevel



therapistVerified



therapistCorrection



sourceType



modelVersion





모든 field가 항상 필요한 것은 아니다.



게임/과제 유형에 맞게 nullable하게 설계한다.





\# ============================================================

\# 4. GAME SCORE != CLINICAL MEASURE

\# ============================================================



절대:



게임 점수 80점

=

발음 정확도 80점



으로 연결하지 않는다.





다음 세 종류를 분리한다.





GAMEPLAY DATA



예:



별 획득



높이



몬스터 진행



보물



XP





SYSTEM-MEASURED SPEECH DATA



예:



발화 지속시간



response latency



attempt count



cue 사용



speech activity





AI-ESTIMATED SPEECH DATA



예:



phoneme score



possible error pattern



confidence



alignment





CLINICIAN-VERIFIED DATA



예:



정확 산출 여부



실제 error type



cue response



generalization 판단





이 네 가지를 DB/UI에서 명확하게 구분한다.





\# ============================================================

\# 5. SKY CLIMB의 언어치료적 의미

\# ============================================================



아이에게:



"목소리로 호야를 하늘로 날리는 게임"





Therapist에게:



지속 발화와 발성 조절을 관찰할 수 있는 activity.





추적 가능한 정보:



speech onset



speech offset



sustain duration



pause duration



number of interruptions



number of attempts



cue level



response latency



audio quality



target sound



independent vs cued production





예:



호야가 6초 동안 상승했다



를



"치료 성과 6초"



라고 바로 해석하지 않는다.





실제 evidence:



Target:

/ㅅ/



Sustained segments:

2.1s

2.6s

2.8s



Interruptions:

1



Independent attempts:

2/3



Cue:

visual once



AI confidence:

MEDIUM-HIGH





처럼 제공한다.





\# ============================================================

\# 6. MONSTER ADVENTURE의 언어치료적 의미

\# ============================================================



아이에게:



"발음하면 호야가 마법을 쓰는 게임"





Therapist에게:



단어 수준 target phoneme production을 반복 관찰하는 task.





각 공격 event에 기록:



target word



target phoneme



word position



attempt number



expected phones



observed phones



possible substitution



possible omission



possible distortion



AI confidence



cue used



independence



response latency



retry count





예:



아이:



"사과"





호야:

마법 공격





Therapist:



Target:

/ㅅ/



Position:

INITIAL



Word:

사과



Attempt:

1



Cue:

NONE



AI Result:

possible correct production



Confidence:

HIGH



Clinician:

Not yet verified





같은 식으로 연결한다.





\# ============================================================

\# 7. MAGIC BEAM의 언어치료적 의미

\# ============================================================



아이에게:



"길게 소리를 내면 호야의 빔이 강해지는 게임"





Therapist에게:



sustained production,

frication 유지,

발화 끊김,

반복 시 안정성을 볼 수 있는 자료.





특히 /ㅅ/ 같은 무성 마찰음에서:



pitch만 보지 않는다.





가능한 evidence:



frication duration



high-frequency energy



spectral evidence



speech continuity



pause count



attempt count



cue level



audio quality



AI confidence





그래프에서는:



Beam Power



자체보다



Sustained Production Duration



Attempt-to-Attempt Stability



Cue Dependence



등의 임상지원 지표를 우선한다.





\# ============================================================

\# 8. CONVERSATION QUEST의 언어치료적 의미

\# ============================================================



아이에게:



"호야와 이야기하며 같이 모험하는 이야기"





Therapist에게:



연습된 말소리가

자연스러운 문맥에서 일반화되는지

관찰할 수 있는 activity.





기록:



prompt type



target elicitation method



spontaneous vs prompted



target word



sentence context



target phoneme



word position



response latency



cue used



recast used



number of repetitions



AI confidence





특히 구분:



DIRECT IMITATION



PROMPTED PRODUCTION



SELF-GENERATED



CONVERSATIONAL



SPONTANEOUS





같은 /ㅅ/ 산출이어도

어떤 조건에서 나왔는지가 다르므로

같은 값으로 뭉개지 않는다.





\# ============================================================

\# 9. HOYA REACTION ALSO HAS MEANING

\# ============================================================



호야 animation도 clinical logic과 연결한다.





예:



LISTENING



=

아동 발화 대기





ENCOURAGE



=

retry / supportive cue





MODEL



=

target auditory model 제공





CHEER



=

참여/시도/과제 완료 reinforcement





절대:



SAD



ANGRY



DISAPPOINTED



와 같은 캐릭터 반응을

잘못된 발음에 연결하지 않는다.





호야의 animation은

아동에게 친근한 feedback channel이지

punishment channel이 아니다.





\# ============================================================

\# 10. THERAPY SESSION TIMELINE

\# ============================================================



Therapist Dashboard에:



Session Timeline



을 만든다.





예:



10:03:12

Conversation Quest 시작





10:03:35

Target /ㅅ/, "사과"

Self-generated

Independent

HIGH confidence





10:04:02

Target /ㅅ/, "수박"

Prompted

Visual cue





10:04:30

Magic Beam

Sustain 2.1 sec





10:04:43

Magic Beam

Sustain 2.7 sec





10:05:10

Break selected





각 이벤트를 클릭하면

원래 게임 상황과 speech evidence를 볼 수 있게 한다.





\# ============================================================

\# 11. THERAPIST SHOULD SEE CONTEXT

\# ============================================================



"정답/오답"



만 보여주지 않는다.





Therapist가 알아야 할 것:



무슨 활동 중이었는가



무슨 단어였는가



어떤 음소가 target이었는가



어느 위치였는가



몇 번째 시도였는가



어떤 cue가 있었는가



아이가 독립적으로 말했는가



얼마나 기다린 후 말했는가



AI가 얼마나 확신하는가



같은 target의 이전 반응은 어땠는가





그래야 하나의 datapoint가

언어치료적인 의미를 갖는다.





\# ============================================================

\# 12. CLINICAL DATA HIERARCHY

\# ============================================================



Dashboard의 정보를:



Overview



↓



Target Detail



↓



Session Detail



↓



Attempt Evidence



로 내려가게 한다.





OVERVIEW:



이번 주 target



generalization level



independent production trend



cue dependence



AI confidence distribution





TARGET DETAIL:



/ㅅ/



position



word level



sentence level



conversation level



error patterns





SESSION DETAIL:



activity



games



attempts



cue



latency



duration





ATTEMPT EVIDENCE:



expected



observed



confidence



cue



context



therapist decision





\# ============================================================

\# 13. PHONEME PROFILE

\# ============================================================



아동마다:



PronunciationProfile



을 만든다.





예:



ㅅ



Initial:

Improving



Medial:

Limited data



Final:

Stable





ㄹ



Initial:

Emerging



Medial:

Needs review





단:



Stable / Improving 등도

충분한 sample과 clinician rule 없이

AI가 확정적인 clinical label로 사용하지 않는다.





가능하면:



Observed trend



Clinician status



를 분리한다.





\# ============================================================

\# 14. GENERALIZATION PROFILE

\# ============================================================



같은 phoneme을:



Sound



Syllable



Word



Phrase



Sentence



Conversation



Spontaneous





단계로 분석한다.





예:



/ㅅ/



Word:

8/10 AI-supported observations



Sentence:

4 observations



Conversation:

2 observations



Spontaneous:

INSUFFICIENT DATA





No Data를

0점처럼 표시하지 않는다.





\# ============================================================

\# 15. INDEPENDENCE IS IMPORTANT

\# ============================================================



같은 정확 산출이어도:



모델을 듣고 따라한 경우



vs



스스로 말한 경우



는 의미가 다르다.





따라서 기록:



INDEPENDENT



MINIMAL\_CUE



VISUAL\_CUE



AUDITORY\_MODEL



DIRECT\_IMITATION



SIMULTANEOUS





Therapist Dashboard에서:



Independent Production %



와



Cue-supported Production %



을 분리해서 보여준다.





\# ============================================================

\# 16. CUE EFFECTIVENESS

\# ============================================================



어떤 cue가 도움이 되는지도 분석 가능하게 한다.





예:



/ㅅ/



No cue:

40% AI-supported success





Visual cue:

55%





Auditory model:

70%





그러나:



"Auditory cue가 이 아동에게 가장 좋은 치료법"



이라고 AI가 자동 결론 내리지 않는다.





표현:



"최근 세션에서 auditory model 이후

target production 성공 관찰이 더 많았습니다."





Therapist가 최종 해석한다.





\# ============================================================

\# 17. RESPONSE TIME HAS CONTEXT

\# ============================================================



response latency도

clinical support signal로 기록한다.





예:



Hoya prompt



↓



3.1 sec



↓



Child response





하지만:



느린 반응

=

장애 심각



으로 해석하지 않는다.





Therapist가:



wait time 조절



cue timing



task difficulty



fatigue



등을 생각할 수 있게 하는 자료이다.





\# ============================================================

\# 18. RETRY PATTERN

\# ============================================================



Retry도 그냥 실패 횟수가 아니다.





기록:



Why retry?



AI\_UNCERTAIN



POOR\_AUDIO



CHILD\_REQUESTED



THERAPIST\_POLICY



TARGET\_NOT\_DETECTED





같은 이유를 구분한다.





그래야:



AI가 못 들은 것



과



아이의 production difficulty



를 섞지 않는다.





\# ============================================================

\# 19. ERROR PATTERN

\# ============================================================



AI가 가능한 오류를 제시할 수 있다.





예:



Possible substitution



Possible omission



Possible distortion





하지만 UI에:



AI hypothesis



라고 명확히 한다.





Therapist:



CONFIRM



CORRECT



REJECT





가능.





확정된 데이터와

AI 추정 데이터를 분리한다.





\# ============================================================

\# 20. THERAPIST CORRECTION BECOMES VALUABLE DATA

\# ============================================================



예:



AI:



/ㅅ/ → /ㄷ/

possible substitution





Therapist:



"대치는 아니고 왜곡임"





↓



Original AI result 보존



↓



Therapist correction 저장



↓



Audit event



↓



PronunciationProfile 재계산 가능





향후 모델 개선용 자료와

clinical record를 분리한다.





모델 학습 사용에는

별도 consent가 필요하다.





\# ============================================================

\# 21. CLINICAL GRAPH PRINCIPLE

\# ============================================================



그래프는 예쁜 dashboard용 장식이 아니다.





모든 graph가 질문 하나에 답해야 한다.





예:



"이 음소는 시간이 지나면서 어떻게 변했는가?"



→ Target Phoneme Trend





"어느 위치에서 어려움이 보이는가?"



→ Word Position Matrix





"도움 없이 말하는 비율이 늘고 있는가?"



→ Independence Trend





"어떤 cue 뒤에 산출이 달라졌는가?"



→ Cue Response Graph





"연습한 단어가 대화까지 일반화되는가?"



→ Generalization Ladder





"AI가 판단을 확신하고 있는가?"



→ Confidence Distribution





"반복할수록 안정되는가?"



→ Consistency View





"아이가 너무 많은 반복을 요구받고 있는가?"



→ Attempt/Fatigue View





\# ============================================================

\# 22. THERAPIST HOME DASHBOARD

\# ============================================================



Therapist Home에서

한눈에 보여줄 것:





Current Targets



Recent Sessions



Clinical Alerts



Pending AI Observations



Pending Therapist Verification



Independent Production Trend



Cue Dependence



Generalization



AI Confidence



Game / Activity Recommendation





"점수가 낮습니다"



같은 단순 alert 대신:





예:



"/ㅅ/ 어두 단어에서

최근 3개 세션 모두 auditory model 이후 산출이 관찰됨."





또는:



"Conversation level 자료가 아직 2건으로

generalization 판단에는 데이터가 부족함."





처럼 context-rich하게 표시한다.





\# ============================================================

\# 23. SESSION SUMMARY

\# ============================================================



한 세션이 끝나면

자동으로 Therapy Session Summary draft를 만든다.





예:



Targets:

ㅅ initial





Activities:

Conversation Quest

Monster Adventure

Magic Beam





Attempts:

14





Independent:

6





Visual cue:

3





Auditory model:

4





Uncertain AI:

1





Sustain:

median 2.4 sec





Generalization:

Word → Sentence attempts observed





Clinician verification:

Pending





이것은:



자동 clinical diagnosis가 아니라



session evidence summary



이다.





\# ============================================================

\# 24. THERAPIST NOTE

\# ============================================================



AI가 clinical note 초안을 만들 수 있다.





예:



"오늘 /ㅅ/ 어두 단어를 중심으로

단어 및 문장 수준 산출을 관찰하였다.

독립 산출과 auditory model 이후 산출이 모두 기록되었으며,

대화 수준 자료는 아직 제한적이었다."





하지만 저장 전:



Therapist Review



Edit



Approve



필수.





\# ============================================================

\# 25. GAME RECOMMENDATION MUST HAVE CLINICAL REASON

\# ============================================================



추천:



"Magic Beam"



만 보여주지 않는다.





대신:



Recommended Activity:

Magic Beam





Clinical Purpose:

Sustained /ㅅ/ production





Reason:

최근 3개 comparable attempts에서

sustain duration이 짧고,

word-level target observations는 상대적으로 안정적이었다.





Evidence:

Session 12

Session 13

Session 14





Confidence:

MEDIUM





Therapist:

Accept

Modify

Reject





게임 추천도

언어치료적 목적과 연결된다.





\# ============================================================

\# 26. EVERY GAME NEEDS A CLINICAL PURPOSE

\# ============================================================



GameRegistry의 모든 GameDefinition에

다음 field를 추가/검토한다.





clinicalPurpose



targetSkill



observableSignals



supportedGeneralizationLevels



recommendedCueTypes



clinicalLimitations





예:



Sky Climb



clinicalPurpose:

sustained production / breath-speech interaction support



observableSignals:

speech duration

pause

continuity



limitation:

game performance itself is not a diagnostic measure





Monster Adventure



clinicalPurpose:

repeated word-level target production





Magic Beam



clinicalPurpose:

sustained fricative production





Conversation Quest



clinicalPurpose:

contextual and spontaneous generalization observation





\# ============================================================

\# 27. THERAPIST CAN TRACE GAME → THERAPY

\# ============================================================



Therapist UI에서:



Game



↓



Clinical Purpose



↓



Target



↓



Observed Evidence



↓



Interpretation Support



↓



Next Decision





로 연결해야 한다.





예:



Monster Adventure

↓



/ㅅ/ 어두 단어 연습

↓



사과 / 사자 / 수박

↓



독립 4회

visual cue 2회

uncertain 1회

↓



독립 산출 비율 증가 관찰

↓



다음 세션:

sentence context 검토





\# ============================================================

\# 28. CHILD DOES NOT SEE CLINICAL LABELS

\# ============================================================



아이 화면에서는:



"독립 산출 60%"



"왜곡"



"PCC"



"음운과정"



"임상 지표"



를 보여주지 않는다.





아이:



"호야가 힘을 얻었어!"



"조금 쉬었다가 다시 해볼까?"



"우와, 별을 찾았어!"



만 본다.





Therapist:



동일 event의

clinical evidence를 본다.





\# ============================================================

\# 29. CLINICAL SEMANTIC TRANSLATION LAYER

\# ============================================================



새 abstraction을 검토한다.





ClinicalMeaningMapper



또는:



TherapyEvidenceMapper





역할:



raw game/speech event



↓



언어치료 관찰 단위로 변환





예:



VOICE\_CONTINUE 2800ms



\+



Target ㅅ



\+



No cue



\+



Attempt 1



↓



ClinicalObservation:



Independent sustained /ㅅ/



duration 2.8s



confidence HIGH





즉:



game telemetry를

그대로 Therapist에게 보여주지 않는다.





Clinical semantic layer를 통과시킨다.





\# ============================================================

\# 30. DATA PROVENANCE

\# ============================================================



모든 observation에 source를 둔다.





SYSTEM\_MEASURED



AI\_ESTIMATED



THERAPIST\_VERIFIED



THERAPIST\_ENTERED



CAREGIVER\_REPORTED





예:



sustainDuration:

SYSTEM\_MEASURED





errorPattern:

AI\_ESTIMATED





verifiedErrorPattern:

THERAPIST\_VERIFIED





이 provenance를 UI에서도 확인 가능하게 한다.





\# ============================================================

\# 31. EVIDENCE QUALITY

\# ============================================================



각 observation마다:



confidence



sample count



audio quality



verification state



를 함께 본다.





값 하나만 크게 보여주지 않는다.





예:



/ㅅ/ accuracy:



82%



가 아니라:





AI-supported observations:

9 / 12



HIGH confidence:

6



MEDIUM:

3



UNCERTAIN:

3



Therapist verified:

4





처럼 맥락을 제공할 수 있어야 한다.





\# ============================================================

\# 32. NO FALSE PRECISION

\# ============================================================



근거가 부족한 상황에서:



82.37%



처럼 과도하게 정밀한 수치를 사용하지 않는다.





특히 baseline pronunciation model에서는

false precision을 피한다.





필요하면:



Emerging evidence



Limited data



Needs clinician review



로 표시한다.





\# ============================================================

\# 33. SESSION COMPARABILITY

\# ============================================================



서로 다른 난이도의 데이터를

단순 평균하지 않는다.





예:



word-level /ㅅ/



와



conversation-level /ㅅ/



를



하나의 accuracy line으로 합치지 않는다.





비교할 때 최소한:



phoneme



position



generalization level



cue level



activity type



을 고려한다.





\# ============================================================

\# 34. THERAPIST FILTERS

\# ============================================================



Clinical Dashboard filter:



Target phoneme



Word position



Generalization level



Cue level



Activity



Game



Date



Confidence



Verification state





예:



ㅅ

\+

Initial

\+

Word

\+

Independent only



만 볼 수 있게 한다.





\# ============================================================

\# 35. TREATMENT GOAL VERSIONING

\# ============================================================



치료 목표가 바뀌면

과거 데이터 해석 context도 유지한다.





TrainingGoal V1



↓



sessions





Therapist changes goal





TrainingGoal V2





과거 session을

새 목표 기준으로 다시 써버리지 않는다.





\# ============================================================

\# 36. OBSERVATION VS INTERPRETATION

\# ============================================================



매우 중요.





Observation:



"독립 /ㅅ/ 어두 산출 4회 관찰"





Interpretation:



"독립 산출이 증가하고 있음"





Clinical Decision:



"문장 수준으로 확장"





세 층을 분리한다.





AI는:



Observation 생성



Interpretation suggestion



까지 지원할 수 있다.





Clinical Decision은

Therapist에게 있다.





\# ============================================================

\# 37. EVIDENCE CARD

\# ============================================================



Therapist UI에:



Clinical Evidence Card



component를 검토한다.





예:



\----------------------------------



Target

/ㅅ/ Initial





Context

Monster Adventure





Word

사과





Level

Word





Attempt

2 / 3





Cue

Visual





AI Observation

Possible correct production





Confidence

HIGH





Audio quality

GOOD





Source

AI ESTIMATE





\[Confirm] \[Correct] \[Reject]



\----------------------------------





이 카드가

임상 dashboard의 기본 단위가 될 수 있다.





\# ============================================================

\# 38. CLINICAL VALUE OF PLAY

\# ============================================================



문서와 공모전 발표에서:



"게임을 통해 아이가 재미있게 연습한다"



에서 끝내지 않는다.





다음 메시지를 강조한다.





"게임의 모든 주요 interaction이

언어치료 목표와 연결되어 있으며,

게임 중 생성되는 말소리 데이터를

임상적 맥락을 가진 관찰 자료로 변환한다."





즉:



GAMEPLAY



↓



STRUCTURED SPEECH OBSERVATION



↓



THERAPIST EVIDENCE



↓



CLINICAL DECISION





\# ============================================================

\# 39. EXAMPLE — ONE CHILD SESSION

\# ============================================================



공모전 Demo용 대표 example을 만든다.





THERAPIST GOAL:



/ㅅ/ 어두

word → sentence transition





Child starts:



Conversation Quest





호야:

"피크닉에 뭐 가져갈까?"





Child:

"사과"





↓



Hoya picks apple





Clinical:



Target:

/ㅅ/ Initial



Level:

Word in conversational context



Production:

Independent



Confidence:

HIGH





↓



Monster Adventure





Target:

"사자"





Child production





↓



Hoya attacks





Clinical:



Word level



Attempt 2



Visual cue used





↓



Magic Beam





Child:

"스────"





↓



Hoya beam





Clinical:



Sustain 2.6 sec



No cue





↓



Session finished





Therapist sees:





Independent observations:

4





Cued:

2





Uncertain:

1





Word:

5 samples





Sentence:

2 samples





Conversation:

1 sample





Sustain median:

2.4 sec





↓



AI Recommendation:



"sentence-level /ㅅ/ activity를

조금 더 관찰하는 것을 고려"





↓



Therapist:



Accept / Modify / Reject





이 전체가

하나의 closed loop이다.





\# ============================================================

\# 40. DATABASE / API

\# ============================================================



ClinicalObservation,

TherapistVerification,

CueEvent,

ClinicalSessionSummary



또는 동등한 model이 필요한지 검토한다.





과도한 table 분리는 피한다.





필요 API 예:



GET /api/students/{id}/clinical-overview



GET /api/students/{id}/phoneme-profile



GET /api/sessions/{id}/clinical-observations



GET /api/observations/{id}



POST /api/observations/{id}/verify



POST /api/observations/{id}/correct



POST /api/observations/{id}/reject





모든 endpoint에

RBAC / child access 검사를 적용한다.





\# ============================================================

\# 41. PRIVACY

\# ============================================================



ClinicalObservation에는

가능한 한 raw audio 자체 대신:



derived evidence



를 저장한다.





Raw audio는 기존 Rev.4 정책:



default permanent storage OFF





를 유지한다.





audio 없이도 치료사가 판단 가능한 경우:



transcript



phoneme evidence



context



cue



confidence



등을 우선한다.





실제 audio review 기능을 향후 추가할 경우

별도 consent / retention policy가 필요하다.





\# ============================================================

\# 42. CLINICAL RESEARCH LINK

\# ============================================================



Rev.4의:



CLINICAL\_EVIDENCE.md



연구와 이번 기능을 직접 연결한다.





각 주요 metric / feature마다:



Clinical concept



Evidence source



Population



Product implementation



Automation boundary



Therapist responsibility





를 기록한다.





예:



Cue fading

↓



clinical literature

↓



CueLevel tracking

↓



system records cue response



BUT



AI does not prescribe treatment autonomously.





\# ============================================================

\# 43. TESTS

\# ============================================================



추가 automated tests:





Game event

→ ClinicalObservation generated





Sky Climb sustain

→ duration observation





Monster target

→ word/position context preserved





Magic Beam

→ sustained-production context





Conversation Quest

→ spontaneous/prompted distinction





Cue

→ observation stores cue level





No cue

→ independent state





LOW confidence

→ not counted as verified failure





UNCERTAIN

→ separate category





Therapist Confirm

→ verified state





Therapist Correct

→ AI original preserved





Therapist Reject

→ excluded from clinician-verified metric





No Data

→ not zero





Different generalization levels

→ not merged incorrectly





Different cue conditions

→ distinguishable





Clinical Evidence Card

→ shows provenance





Student

→ cannot access therapist clinical data





Unauthorized therapist

→ cannot access student clinical evidence





\# ============================================================

\# 44. FINAL ACCEPTANCE — CLINICAL MEANING

\# ============================================================



다음이 충족되어야 한다.





\[ ] 모든 주요 게임은 clinicalPurpose를 가진다.



\[ ] 주요 speech/game event가 ClinicalObservation으로 변환된다.



\[ ] Hoya action과 clinical evidence가 같은 event에서 연결된다.



\[ ] 게임 점수와 임상 지표를 분리한다.



\[ ] Therapist는 각 observation의 context를 볼 수 있다.



\[ ] phoneme / position / level / cue / attempt 정보가 보존된다.



\[ ] independent와 cued production을 구분한다.



\[ ] prompted와 spontaneous production을 구분한다.



\[ ] AI uncertainty와 child difficulty를 구분한다.



\[ ] response latency가 context와 함께 기록된다.



\[ ] retry reason을 구분한다.



\[ ] No Data와 Failure를 구분한다.



\[ ] AI estimate와 clinician verified를 구분한다.



\[ ] Therapist가 Confirm / Correct / Reject 가능하다.



\[ ] 그래프에서 개별 evidence로 drill-down 가능하다.



\[ ] 모든 clinical metric은 provenance를 가진다.



\[ ] clinical recommendation에는 reason/evidence/confidence가 있다.



\[ ] Child UI에 clinical terminology를 노출하지 않는다.



\[ ] Therapist UI에서는 전문적인 정보를 충분히 제공한다.



\[ ] AI가 diagnosis/treatment prescription을 자동 확정하지 않는다.



\[ ] Therapist가 최종 의사결정자이다.





\# ============================================================

\# 45. FINAL PRODUCT PHILOSOPHY

\# ============================================================



Speech Hero V2의 최종 철학은 다음과 같다.





FOR THE CHILD:



"I talk to Hoya.

I play with Hoya.

My voice makes Hoya move."





FOR THE THERAPIST:



"Every meaningful interaction produces

structured speech-language therapy evidence."





FOR THE AI:



"Observe, estimate, explain uncertainty,

and support the clinician."





FOR THE CLINICIAN:



"Interpret the evidence

and make the clinical decision."





즉 최종 구조는:





PLAY



↓



SPEECH



↓



HOYA ACTION



↓



STRUCTURED OBSERVATION



↓



CLINICAL EVIDENCE



↓



THERAPIST DECISION



↓



NEXT GOAL



↓



NEXT PLAY





이 closed loop를

Speech Hero V2의 핵심 architecture로 확정한다.





\# ============================================================

\# 46. PLAN UPDATE

\# ============================================================



현재 Claude Plan 단계라면

production code는 구현하지 않는다.





이 문서를:



`.orca/tasks/4/plan.md`



에 Clinical Meaning Rev.5로 반영한다.





반드시 수정/확장:



Product Vision



Architecture V2



Game System



Tiger System



Speech Pipeline



Clinical Observation Model



Therapist Dashboard



Clinical Graphs



Database



API



Therapist Loop



Game Recommendation



Clinical Evidence



Tests



Competition Demo



Acceptance Criteria



Risk Register



Files



Final Review Checklist





반영 후:



"Clinical Meaning Rev.5 반영 완료"



라고 보고하고

다시 Plan Gate로 돌아와라.





Codex 구현은

사용자가 continue를 승인한 뒤에만 시작한다.
