# Speech Hero V2
# 언어치료·AI 설계 근거 및 임상적 해석

기준: `feature/speech-hero-v2-hardening`의 `8bcacd7` 코드와 자동 테스트, 2026-09-29 확인한 외부 출처. §12 호야 적응형 대화는 `feature/hoya-adaptive-chat` 기준이다. 이 문서는 현재 제품 구조를 설명하며 진단·치료 효과를 주장하지 않는다.

## 1. 문서 목적과 제품의 범위

Speech Hero는 **AI 기반 아동 발음·말소리 훈련 및 언어재활사 의사결정 지원 시스템**이다. 아이에게는 놀이, 치료사에게는 근거. 음성 입력을 게임 반응과 관찰 기록으로 바꾸고, 치료사가 그 기록을 해석해 다음 목표를 결정하도록 돕는다. AI는 치료 결정을 대신하는 것이 아니라, 반복 가능한 측정과 근거 정리를 통해 언어재활사의 판단을 보조한다.

### 현재 구현됨

아동의 네 가지 5라운드 게임, 브라우저 음향 측정, 필요한 게임의 브라우저 음성 인식, 서버의 규칙 기반 평가, 관찰·검증·추천 기록, 치료사 화면이 있다. [라운드 정의](../../backend/app/games/rounds.py), [발화 평가](../../backend/app/games/evaluation.py), [관찰 생성](../../backend/app/clinical/observation_builder.py)이 근거다.

### 현재 부분 구현

게임의 세부 장면·단서 단계·상호작용은 제한적이다. Conversation Quest의 호야 응답은 [고정된 DEMO 규칙](../../backend/app/games/conversation.py)이며 실제 대화 모델이나 문맥 기억이 아니다. 실물 마이크·Android 브라우저·3D 렌더·HTTPS 배포 조합은 수동 확인이 남았다. [기존 검증 기록](VALIDATION_REPORT.md)도 이 범위를 구분한다.

### 향후 연구/검증 필요

한국어 아동 음성에 대한 독립적인 전문가 라벨과 기기·환경별 검증이 없다. 현재 점수와 시간 임계값은 **현재 프로토타입 판정 기준(product operational threshold)**이지 임상 표준이 아니다.

## 2. 해결하려는 문제와 훈련 계층

한 번의 정오 점수만으로는 아동이 모델을 듣고 따라 했는지, 그림만 보고 산출했는지, 낱말 밖에서도 같은 소리를 쓰는지 알기 어렵다. Speech Hero는 목표 음소, 단어 내 위치, 시도 횟수, 제시 단서, 라운드, 음향 요약, 추정 결과를 함께 남긴다. 치료사는 이 자료로 다음 관찰 과제와 목표를 선택할 수 있다. 말소리 훈련에서 목표 소리의 확립 이후 음절·단어·구/문장·대화로 사용 맥락을 넓히는 접근은 [ASHA의 말소리장애 지침](https://www.asha.org/practice-portal/clinical-topics/articulation-and-phonology/)과 방향이 맞지만, 이 제품의 라운드 순서 자체가 임상적으로 검증된 프로토콜이라는 뜻은 아니다.

| 단계 | 유도하는 반응과 치료적 질문 | 현재 코드의 구현·한계 |
|---|---|---|
| 음소/소리 | 목표 소리를 시작하고 유지할 수 있는가 | Magic Beam·Sky Climb의 `SOUND`; 마찰·지속 시간 같은 음향 근거를 본다. 개별 조음 위치를 직접 측정하지 않는다. |
| 음절 | 자음에서 모음으로 연결하거나 모델을 따라 산출하는가 | Magic Beam R5, Monster Adventure R1. 전이는 시간 특징으로 근사한다. |
| 단어 | 목표 음소를 단어 안에서 산출하는가; 모방과 그림 명명이 다른가 | Monster Adventure R2~R4. 인식 문장의 문자 기반 음소 정렬은 실제 조음 정확도의 대리 지표다. |
| 구 | 더 긴 발화에 목표를 포함하는가 | Monster Adventure R5, Conversation Quest R3. |
| 문장 | 질문에 문장으로 반응하는가 | Conversation Quest R4. 문장 전체의 자연스러움은 평가하지 않는다. |
| 대화 | 선택·질문·응답 문맥에서 목표 음소가 나타나는가 | Conversation Quest. 목표 음소 검출은 정오 판정과 구분한다. |
| 자발화/일반화 | 제시 단서가 줄어든 상황에서도 목표를 쓰는가 | Conversation Quest R5는 관찰 기회를 제공한다. 가정·학교로의 전이나 치료 효과는 검증하지 않았다. |

단계마다 유도 반응과 맥락이 달라야 치료사가 같은 `success`라도 모방 성공인지 독립 산출인지 해석할 수 있다. 단어 과제 결과를 곧바로 일상 대화의 일반화로 읽지 않는다.

## 3. 네 게임의 치료적 목적

### Magic Beam — 지속·마찰·전이

| 라운드 | 유도 반응 | 실제 판정 근거와 치료사 활용 |
|---|---|---|
| R1 모델 따라 소리 | 청각 모델 뒤 /ㅅ/ 계열 소리 지속 | `FRICATION`: `bestRunMs`와 `fricationMs/activeMs`를 보고, 모델 뒤에 소리가 지속됐는지 검토한다. |
| R2 혼자 빔 쏘기 | 시각 단서로 더 긴 독립 지속 산출 | 같은 근거를 더 긴 목표 시간에 적용해 단서가 줄어든 상황을 비교한다. |
| R3 끊기지 않는 빔 | 연속 산출과 중단 | `CONTINUITY`: 지속·마찰과 `interruptionCount`를 함께 본다. |
| R4 리듬 펄스 | 끊어 발성하는 반복 onset | `PULSES`: 목표 길이 이상의 `sustainSegmentsMs`가 세 구간 이상인지 본다. |
| R5 음절 빔 | 마찰음 뒤 모음 연결 | `TRANSITION`: `onsetFricationMs`와 `voicedAfterFricationMs`를 본다. |

브라우저는 `durationMs`, `voicedMs`, `activeMs`, `bestRunMs`, `fricationMs`, `meanRmsDb`, `noiseFloorDb` 등을 보낸다. 서버가 모든 필드를 각 라운드의 정오 조건으로 쓰는 것은 아니다. 예를 들어 `meanRmsDb`와 `noiseFloorDb`는 음질/SNR 게이트에 쓰이고 `peakRmsDb`는 저장되는 근거이지 Magic Beam 통과 기준이 아니다. [평가 코드](../../backend/app/games/evaluation.py), [음질 코드](../../backend/app/pronunciation/audio_quality.py).

### Sky Climb — 발성 조절과 쉼 후 재개

R1은 짧은 시작·지속, R2는 더 긴 지속, R3은 에너지 평균 범위와 지속, R4는 **발성 → 쉼 → 다시 발성**, R5는 더 긴 지속을 요청한다. R4의 `RE_ONSET`은 한 발화 안에서 목표 길이 이상인 두 지속 구간과 `maxPauseMs` 300~2200ms를 요구한다. 브라우저 종료 유예는 2500ms이므로 서버의 쉼 상한이 그보다 짧다. 이것은 재시작을 관찰하기 위한 **제품의 조작적 정의**다. 호흡 조절 장애의 검사나 임상 표준 시간 범위가 아니다. 치료사는 쉼과 재개가 관찰됐는지 보되, 피로·지시 이해·마이크 환경을 함께 판단해야 한다.

### Monster Adventure — 목표 음소의 맥락 확장

R1 음절 모방, R2 단어 모방, R3 그림 보고 독립 명명, R4 **새 장면에서 훈련 단어 산출**, R5 구 수준 요청이다. 서버의 [시작 로직](../../backend/app/main.py)은 R2·R3·R4에서 같은 세션에 이미 고른 단어를 피한다(후보가 소진되면 재사용 가능). 이는 단순 반복 암기 영향을 줄이고 장면·유도 방식이 다른 반응을 비교하려는 제품 설계다. R4의 `itemSource`는 `TRAINING_BANK`이며 **미훈련 단어 검사**가 아니다. 단어의 문자 정렬 점수도 일상 대화 일반화와 동일시하지 않는다.

### Conversation Quest — 구조화된 유도에서 열린 응답으로

R1 선택형 단어, R2 그림/열린 질문, R3 문장 틀을 이용한 구, R4 문장 응답, R5 자유로운 소풍 이야기 순서다. 구조화된 유도에서 더 자발적인 산출 기회로 이동하지만 현재 서버는 ASR 문장에 목표 음소가 있는지를 `target_observed` 또는 `not_target_attempt`로만 구분한다. 목표가 없으면 이야기는 계속되지만 임상 정오 점수로 계산하지 않는다. 고정된 호야 응답과 목표 음소 검출만으로 자발화의 질이나 치료 효과가 검증됐다고 볼 수 없다.

## 4. 아동 경험, 단서와 독립성

`LOW`·`UNCERTAIN`은 [관찰 생성기](../../backend/app/clinical/observation_builder.py)의 근거 강도 표시이고 `NO_SPEECH`는 발화가 검출되지 않았다는 상태다. 모두 아동의 실패 판정과 다르다. 음질 불량이나 불확실한 인식은 `LISTEN_AGAIN`으로, 반복 불확실은 `UNCERTAIN_SKIP`과 `NEUTRAL_CONTINUE` 성격의 다음 항목 진행으로 처리한다. `NO_SPEECH`는 성공/재시도 분모에 넣지 않는다. V2의 `TARGET_RETRY`는 부드러운 단서(`gentle`)를 실어 보내고, 기존 모험 정책은 재시도·`HINT_REQUIRED`·단계 하향·항목 건너뛰기를 제공한다. [정책](../../backend/app/training/policy.py), [V2 처리](../../backend/app/main.py), [아동 화면](../../src/child/ActivitySession.tsx).

현재 별도의 정교한 휴식 프로토콜이나 대체 응답 방식의 완성된 단계별 UI는 확인되지 않았다. 이를 이미 제공하는 기능으로 표시하지 않는다. 아동 화면은 놀이 피드백을, 치료사 화면은 불확실·무발화·DEMO와 평가 가능 표본을 분리한 근거를 보여 준다.

단서 수준은 R1/R4 등의 `DIRECT_IMITATION`/`AUDITORY_MODEL`, 그림·시각 제시, `SELF_GENERATED`, `PROMPTED_PRODUCTION`, `CONVERSATIONAL`, `SPONTANEOUS` 메타데이터와 `currentCue`, `independence`(`MODELED`/`INDEPENDENT` 또는 `UNKNOWN`)에 일부 표현된다. 기존 모험에는 치료사 선호 단서와 override가 있다. 다만 매 시도에 실제 제공된 모든 단서를 검증하는 완전한 cue hierarchy는 없다. 치료사는 정오와 함께 **얼마나 도움을 받고 수행했는가**를 읽어야 한다. 모델 직후의 성공과 독립 명명 성공은 같은 능력을 뜻하지 않는다. [ASHA의 stimulability 설명](https://www.asha.org/practice-portal/clinical-topics/articulation-and-phonology/)도 모방 가능성과 맥락을 구별한다.

## 5. 측정 데이터: 생성, 사용, 해석

아래의 “해석”은 치료사가 참고할 수 있는 질문이지 확정 진단이 아니다. 프레임의 음향 특징은 브라우저에서 계산하고 원본 PCM은 앱 서버에 저장하지 않는다. 요약값과 인식 문장은 [Utterance](../../backend/app/models.py)에 저장된다.

| 데이터 / 무엇인가 | 생성 위치·수집 목적 | 실제 판정 사용 | 치료사 화면의 해석 범위 |
|---|---|---|---|
| 20ms 마이크 프레임, RMS·peak, 고주파 비율, spectral centroid, clipping | [AudioCapture](../../src/speech/audioCapture.ts)·[features](../../src/speech/features.ts); 소리의 크기·스펙트럼·포화 추정 | VAD 시작/끝, 마찰 추정, 음질 요약의 입력 | 프레임 원본은 화면에 표시되지 않음. 기기·소음 영향 고려 |
| `noiseFloorDb`, `meanRmsDb`, `peakRmsDb`, `meanHfRatio`, `meanCentroidHz`, `clippingRatio` | 첫 1초 보정과 [VAD](../../src/speech/vad.ts)의 발성 프레임 요약; 신호/배경 분리 | 평균 RMS−잡음 기준과 clipping은 음질 게이트. peak·고주파·중심은 근거 저장; peak 자체는 게임 통과 조건 아님 | 음향 근거 상세에서 볼 수 있으나 조음 정확도 단독 지표가 아님 |
| `durationMs`, `voicedMs`, `activeMs`, `bestRunMs`, `fricationMs` | [MicUtterancePipeline](../../src/speech/micUtterance.ts)·[SustainTracker](../../src/speech/sustainTracker.ts); 발성 길이와 마찰 지속 | `SUSTAIN`, `FRICATION`, `CONTINUITY`, 음질의 너무 짧음/김 확인 | 시도별 지속·마찰 근거. `durationMs`는 끝 무음 유예를 제외 |
| `sustainSegmentsMs`, `pauseCount`, `pauseTotalMs`, `maxPauseMs`, `interruptionCount`, `onsetFricationMs`, `voicedAfterFricationMs`, `energyMean01` | SustainTracker; 반복·쉼·전이·강도 변화를 요약 | `PULSES`, `RE_ONSET`, `CONTINUITY`, `TRANSITION`, `ENERGY_BAND` | 특정 라운드의 수행 단서. 시간·에너지 범위는 제품 기준 |
| ASR `transcript`, recognizer | [WebSpeechRecognizer](../../src/speech/webSpeechRecognizer.ts); 말한 문장의 근사 텍스트 | 단어/대화 게임의 목표 음소 정렬·검출 | ASR이 잘못 들었거나 표준형으로 보정했을 수 있음. 인식기는 대체 후보도 반환하지만 현재 V2 화면은 대표 문장만 API로 보냄 |
| 목표 음소·위치·단어, 라운드·시도·단서·난이도 | [TrainingGoal·TrainingSession·ClinicalObservation](../../backend/app/models.py); 과제 맥락 보존 | 목표 위치의 문자 음소 정렬, 라운드별 규칙, 정책 | 모방·독립 산출·난이도 변화와 함께 결과 비교 |
| AI 추정 결과·오류 태그·치료사 검증 | [speech pipeline](../../backend/app/speech/pipeline.py), 관찰 및 검증 API | `success`/`retry`만 평가 가능 표본; 확인/교정은 요약·활동 제안에 반영 | 원본 AI 추정과 치료사의 최종 해석을 구분 |

## 6. 데이터에서 결과까지: 실제 처리 순서

`아동 음성 → 브라우저 마이크 프레임 → RMS/스펙트럼 특징 → 첫 1초 잡음 보정 → VAD → 발성 프레임 통계 + 지속/쉼/마찰 추적 → AcousticSummary → (단어·대화 게임이면 Web Speech ASR) → 서버 음질 게이트와 게임 규칙/텍스트 정렬 → GameEvent·ClinicalObservation → 치료사 검토 → 다음 목표/활동 제안`.

1. [AudioCapture](../../src/speech/audioCapture.ts)는 Web Audio 분석기에서 20ms 간격으로 프레임을 얻고, [features](../../src/speech/features.ts)는 RMS dB, peak dB, 고주파 비율, spectral centroid, clipping 등을 계산한다.
2. [MicUtterancePipeline](../../src/speech/micUtterance.ts)은 시작 전 1초의 무음 RMS 중앙값으로 `noiseFloorDb`를 보정한다. [VAD](../../src/speech/vad.ts)는 발화 시작/종료를 정한다. `VOICE_END`의 `meanRmsDb`, `peakRmsDb`, `meanHfRatio`, `meanCentroidHz`, `clippingRatio`는 발성 신호 프레임으로 계산해 후행 무음·순간 peak가 섞이지 않게 한다. `durationMs`는 마지막 발성 프레임까지이며 종료 유예는 제외한다.
3. [SustainTracker](../../src/speech/sustainTracker.ts)는 `bestRunMs`, `sustainSegmentsMs`, `maxPauseMs`, `fricationMs`, onset 뒤 유성 구간 등을 만든다. 음질 게이트는 `meanRmsDb−noiseFloorDb`, 길이, clipping을 사용한다. 음질이 부족하면 정오를 보류한다.
4. [ActivitySession](../../src/child/ActivitySession.tsx)은 소리 시작/끝을 [SpeechGameSignal](../../src/control/speechGameSignal.ts)에 전달해 호야 행동을 바꾼다. 음향 요약은 API로 보낸다. Monster Adventure와 Conversation Quest에는 Web Speech ASR도 사용한다. DEMO의 키보드 음향값과 스크립트는 실제 음성 근거가 아니다.
5. [evaluate_round](../../backend/app/games/evaluation.py)은 라운드 규칙에 따라 지속·마찰·쉼을 평가하거나, 단어는 [정규화→단순 한글 G2P→정렬](../../backend/app/speech/pipeline.py)로 근사 점수와 오류 태그를 만든다. 이것은 음성 파형의 직접적인 음소 정렬이나 학습된 발음 모델이 아니다. 대화는 목표 음소 관찰 여부를 정오와 분리한다.
6. 서버는 `Utterance`, `SpeechAnalysis`, `GameEvent`, `ClinicalObservation`을 저장한다. 치료사는 화면에서 근거를 확인·교정·거부하고, 기존 모험 추천은 수락·수정·거절한다. V2 활동 제안도 치료사 결정 후 배정된다. 추천이 목표를 스스로 확정하지 않는다.

## 7. Clinical Observation과 치료사 검증

**Observation ≠ Interpretation ≠ Clinical Decision.** `ClinicalObservation`은 어떤 과제·시도에서 무엇이 측정/추정됐는지의 구조화된 기록이다. `ai_result`, `ai_confidence`와 가능한 오류 태그는 해석 후보이고, 치료사의 `confirm`/`correct`/`reject`가 별도 `ClinicalVerification` 행에 저장된다. 원래 AI 결과를 덮어쓰지 않으므로 사후에 차이와 판단 이력을 볼 수 있다. `SpeechAnalysis`도 `ai_score`/`ai_result`와 `final_score`/`final_result`를 분리한다. [모델](../../backend/app/models.py), [검증 API](../../backend/app/main.py), [치료사 타임라인](../../src/therapist/ClinicalTimeline.tsx).

현재 `provenance`에 실제 기록되는 값은 음향 `CLIENT_REPORTED`(브라우저가 계산해 제출), 목표·단서 `SYSTEM_MEASURED`, 결과 `AI_ESTIMATED`다. `THERAPIST_VERIFIED`와 `THERAPIST_ENTERED`라는 provenance 값은 이 코드에서 생성되지 않는다. 치료사의 확인/입력은 `ClinicalVerification`과 감사 이벤트에 별도로 남는다. **`ClinicalMeaningMapper`라는 별도 클래스/모듈은 현재 없다.** 의미 해석은 관찰 생성, 규칙 평가, 치료사 검토에 분산돼 있다.

실제 음성·비샘플 세션만 `clinical_eligible`이다. DEMO 검토는 `DEMO_CONFIRMED` 등으로 기록하되 임상 요약 통계·활동 제안에서 제외한다. `success`/`retry`만 정오 분모이고 `uncertain`·`no_speech`·`target_observed`는 별도 표본 수다. 자료가 없으면 0%가 아니라 자료 없음이다. 치료사가 확인했다는 사실도 제품의 임상 타당성이 입증됐다는 의미는 아니다.

## 8. AI와 언어재활사의 역할

현재 자동화는 VAD, 음향 특징, 외부 브라우저 ASR, 문자 기반 발음 근사, 오류 패턴 태그, 세션 요약과 규칙 기반 추천 지원이다. `ai_confidence`는 데이터 기반으로 보정된 확률이 아니라 코드가 부여한 범주(`LOW`/`MEDIUM`/`UNCERTAIN`)다. 별도 학습형 발음 모델은 없다. 외부 LLM은 §12의 호야 자유대화에서 설정으로 켰을 때만 **문장 표현**에 쓰이며, 발음 판정·치료 결정에는 쓰이지 않는다.

언어재활사는 목표 음소·위치·단계·단서를 정하고, 문맥·아동의 이해·환경을 고려해 결과를 확인/교정/거부하며 추천을 승인/수정/거절한다. 점수의 높낮이만으로 목표를 바꾸지 않는다. [ASHA 지침](https://www.asha.org/practice-portal/clinical-topics/articulation-and-phonology/)이 강조하는 언어·방언과 맥락을 현재의 단순 규칙이 포괄하지 못한다는 점도 검토해야 한다.

## 9. 현재 데이터셋과 검증 상태

| 구분 | 현재 상태 | 임상 근거로 취급 가능한가 |
|---|---|---|
| Runtime data | 실제 사용자의 브라우저 음향 파생값, ASR 문장, 과제·시도·치료사 판단을 세션에 저장 | 전문가 라벨과 성능 검증 전에는 효능 근거가 아님 |
| DEMO/seed data | 흐름 시연·개발 테스트용 계정과 키보드/스크립트 입력 | 아니오. 임상 통계에서 제외 |
| 자동 테스트 fixture | [R4 합성 프레임 JSON](../../shared/re_onset_mic_cases.json), VAD 단위 테스트, API 테스트 | 아니오. 코드 회귀 검증용 |
| 외부 제공자 | 필요 게임에서 브라우저 Web Speech API 사용. 브라우저/제공자에 따라 처리 방식이 다름 | 자체 학습 데이터나 검증 결과가 아님 |
| 외부 임상 라벨 음성 데이터 | 저장소에서 학습·평가에 사용한 기록 없음 | **NOT VALIDATED — NO LABELED DATA** |

현재 별도의 임상 음성 데이터셋으로 학습 또는 검증하지 않았다. 원본 음성 파일은 앱 서버에 저장하지 않지만 음향 요약·인식 문장·관찰은 저장된다. 따라서 현재 로그를 곧바로 임상 학습 데이터셋으로 부를 수 없다.

## 10. 향후 연구/검증 후보 데이터셋 — 현재 사용하지 않음

아래는 존재와 공개 설명을 확인한 **후보**다. 후보 채택 전 원본 접근 권리, 보호자 동의 범위, 연령·과제·방언, 전문가 전사/음소 라벨의 품질을 별도 확인해야 한다.

| Dataset | 언어·대상 | 확인된 라벨 | 활용 가능성 | 한계 | License / Access |
|---|---|---|---|---|---|
| [AI-Hub 한국어 아동 음성 데이터](https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=540) | 한국어 아동 낭독 음성 | 음성 전사 JSON, 화자·환경 메타데이터 | 아동 ASR의 음질·환경별 연구 후보 | 말소리장애 진단·음소별 오류 라벨로 소개되지 않음. 조음 정확도 검증을 직접 대체하지 못함 | 내국인 신청·승인 필요. [AI-Hub 이용정책](https://aihub.or.kr/intrcn/guid/usagepolicy.do?currMenu=151&topMenu=105)은 출처 표시, 제3자 제공 제한, 상업적 판매 별도 협의 등을 명시. |
| [Korean Children SSD Dataset 연구](https://www.eksss.org/archive/view_article?pid=pss-16-3-87) | 한국어 2~9세, 전형·말소리장애로 연구 내 분류 | 목표 단어·인간 전사·match/mismatch·화자/연령; 논문 기준 573명·4.6시간 | 단어 수준 오류 탐지 방법과 라벨 설계 비교 | 연구의 PWC 기반 분류를 독립 임상 진단으로 간주할 수 없음. 음소 시간 경계 라벨 여부·원자료 입수 가능성 별도 확인 | 논문은 확인됨. 데이터 배포·재사용 허가는 논문만으로 확인되지 않아 연구팀 문의 필요. |
| [Speech Database of Typically Developing and Speech-Impaired Children](https://huggingface.co/datasets/K-Univ/Pathological-child-voice) | 한국어 2~9세 아동, 단어·무의미어·문장 | 연령, 자음정확도, 집단, 자극 유형 메타데이터 | 다양한 과제·집단에서 탐색적 평가 후보 | 배포자는 제작자가 아니라고 명시. 음소별 오류·시간 경계 라벨은 확인되지 않음. 권리와 원본 출처 재확인 필요 | 페이지는 CC BY-NC-ND 4.0, 비영리·사전 사용 범위 통지 조건을 기재. 상업 제품 사용 전 별도 확인 필요. |

한국어가 아닌 아동 SSD 자료는 모델 구조·특징 연구에 참고할 수 있어도 한국어 아동 조음 정확도 검증을 직접 대체하지 않는다. 위 세 후보 중에서도 **phoneme-level annotation과 forced alignment에 바로 쓸 수 있는 시간 경계가 확인된 데이터셋은 없다**. 필요하면 전문가가 동의·품질 관리 절차를 갖춰 별도로 라벨을 구축해야 한다.

### 한국어 아동 발음 데이터셋 선택과 학습형 발음 모델 근거 — PHASE B 조사 결과 (2026-09-29)

상세: [pronunciation_v1 보고서](../../research/pronunciation/reports/pronunciation_v1.md).

1. **현재 production 발음 판정**: 단어 과제는 브라우저 Web Speech 문장 → 정규화 → 단순 G2P → 정렬 → 목표 위치 음소 일치와 점수 기준이다. 지속음 과제는 지속·마찰 시간 규칙이다. 학습된 발음 모델은 없고, 이번 작업으로도 바뀌지 않았다.
2. **데이터셋을 검토한 이유**: 일반 ASR은 아동 발음을 표준 단어로 고쳐 버릴 수 있다. 문헌에서는 아동 음성으로 학습한 음향 모델이 ASR 문장 방식보다 목표 단어 정오 판별에 유리할 수 있다는 결과가 있다. 그래서 공정한 비교가 가능한지 조사했다.
3. **논문 근거(각 논문 자체 데이터, 우리 재현 아님)**:
   - Sung 외 2024: 573명 단어 발화, 화자 분리 교차검증, 음향 분류 정확도 81.6% vs ASR 전사 방식 60.2%.
   - XLS-R SSD 연구: 실제 산출 발음 인식 PER 약 10% vs 일반 Whisper 약 50%.
   - 2026 preprint: 자음 정오 balanced accuracy 약 0.72.
4. **dataset label의 실제 의미**: 공개된 Hugging Face `K-Univ/Pathological-child-voice`는 녹음 1개당 자음정확도(PCC)·TD/SSD 집단만 있다. AI-Hub 아동 음성은 철자 전사다. 둘 다 "이 발화의 /ㅅ/이 맞았는가"의 정답이 아니며, 이를 발화 정오로 바꾸지 않았다. 발화 단위 정오·들은 전사가 있는 연구 데이터(Sung 외, XLS-R SSD, 2026 preprint)는 공개되지 않았다.
5. **offline experiment 결과**: **NOT RUN — DATASET_NOT_SUITABLE.** 학습 모델과 baseline 수치가 없다. 데이터가 생기면 쓸 baseline은 버전을 고정한 공개 ASR과 현재 `analyze()`로 만든 **REPRODUCIBLE_PROXY_BASELINE**이다. Web Speech 경로 자체(CURRENT_RUNTIME_BASELINE)는 오프라인에서 재현할 수 없다. 비교는 화자 단위 분할, 같은 test set, false correction rate 포함, 화자 단위 bootstrap 신뢰구간으로 한다.
6. **현재 runtime 적용 여부**: 적용하지 않았다(SHADOW 포함). 라이선스도 막는 요인이다. HF 데이터는 CC BY-NC-ND 4.0이고 원 제작자 통지가 필요하며 재배포 권한이 불확실하다. AI-Hub는 내국인 승인과 제3자 제공 금지 조건이 있다. 어느 쪽도 제품 사용을 허용하지 않는다.
7. **최종 재검색과 대체 방법 검토(2026-09-29)**: [최종 결정](../../research/pronunciation/reports/pronunciation_final.md). 공개 저장소·AI-Hub·TalkBank·논문을 다시 검색했지만 결론은 같다. 새로 찾은 가장 적합한 라벨 데이터(인천성모병원 JMIR 2025, 3~7세 단어별 언어재활사 이중 전사)도 저자 요청을 거쳐야만 얻을 수 있다. Azure 발음 평가는 ko-KR을 지원하지만 음소 이름 없이 점수만 주므로 /ㅅ/·/ㅈ/·/ㄹ/ 대응이 불확실하다. 비교할 정답 데이터도 없다. 붙이려면 음성 upload 경로·아동 음성 외부 전송·별도 보호자 동의가 새로 필요하다. 그래서 구현하지 않았다(DEFERRED_COMPLEXITY). 제품 동작은 바뀌지 않았다. 라벨 데이터 요청과 자체 라벨링은 향후 작업이다.
8. **clinical validation과 technical evaluation의 차이**: 외부 데이터에서 좋은 수치가 나오더라도 그것은 기술적 평가이고, Speech Hero의 임상 검증이 아니다. 현재 상태는 여전히 **NOT VALIDATED — NO LABELED DATA**이다.

## 11. AI와 언어치료를 결합하는 이유, 안전과 윤리

반복 측정과 시도별 기록은 시간에 따른 변화와 단서 요구량을 보기 쉽게 만든다. 그러나 아동 ASR 오류, 표준형 보정, 환경 소음, 발달·방언·개인차, 미검증 데이터 편향은 거짓 확신을 만들 수 있다. [Macrae의 취학 전 아동 말소리 평가 논문](https://pubs.asha.org/doi/10.1044/persp1.SIG1.39)은 단어와 연결 발화, 오류 패턴, 모방 가능성 등 여러 자료를 함께 볼 필요를 설명한다. Speech Hero의 단일 점수는 그런 종합 평가가 아니다.

보호자 동의가 없는 아동의 활동 시작을 막고, 계정·역할·CSRF·Origin을 검사한다. 원본 음성은 앱 서버에 보관하지 않는다. 인식 문장과 대체 후보는 설정된 보존 기간 뒤 서버 시작 시·운영 중 주기 작업으로 비우지만, 다른 음향·관찰 기록까지 자동 삭제하는 정책은 아니다. 브라우저 Web Speech API의 외부 처리·보존은 실제 제공자 조건 확인이 필요하다. DEMO 자료는 임상 집계에 넣지 않는다. [서버 흐름](../../backend/app/main.py), [보존 작업](../../backend/app/maintenance.py).

## 12. 호야 적응형 대화(Hoya Adaptive Conversation)

게임 밖에서 아동이 호야와 자유롭게 이야기하는 **"호야와 대화하기"** 모드다. 목적은 치료사가 정한 목표 음소가 대화 흐름 안에서 자연스럽게 나올 **기회**를 만드는 것이다. 아이에게는 놀이, 치료사에게는 근거라는 원칙은 같다. 역할은 나뉜다: Speech Engine은 무엇이 관찰됐는지 계산하고, 결정적 대화 정책이 다음 전략을 고르며, 대화 제공자(LLM 또는 DEMO)는 이미 정해진 전략을 한국어 문장으로 표현만 한다. 최종 임상 판단은 치료사가 한다. [대화 서비스](../../backend/app/hoya/service.py), [정책](../../backend/app/hoya/policy.py), [system prompt](../../backend/app/hoya/prompt/system_prompt.md).

### 현재 구현됨

- 근거 상태: 자유대화에는 정해진 목표 단어가 없으므로 정오를 판정하지 않는다. Conversation Quest와 같은 규칙(음질 게이트 + 인식 문장의 목표 음소 검출, [evidence](../../backend/app/hoya/evidence.py))으로 `TARGET_OBSERVED`·`TARGET_NOT_OBSERVED`·`UNCERTAIN`·`NO_SPEECH`만 남긴다. 소리는 들렸는데 인식 문장이 없으면 `UNCERTAIN`이다. ASR이 다르게 들었다는 이유로 오류라고 하지 않는다.
- 정책: 목표 관찰 → 대화 확장, 미관찰·불확실 → 같은 주제 안의 자연스러운 재유도, 무발화 → 기다리기·쉬운 질문, 불확실 반복 → 고르기 쉬운 질문. 목표 미관찰이 두 번 이어지고 치료사가 허용한 단서가 있을 때만 `ALLOWED_CUE`다. 대화에서 줄 수 있는 단서는 `auditory_model`(호야가 자기 문장 속에서 목표 단어를 먼저 들려줌)뿐이다. `visual_mouth`·`tactile_description`은 음성 대화로 줄 수 없고 치료사가 쓴 단서 문구도 없으므로 재유도로 대체한다. 혀·이 위치, 호흡, 촉각 같은 기법은 만들지 않는다.
- 목표 단어: [훈련 단어 목록(BANK)](../../backend/app/training/content.py)만 쓰고 `excluded_words`를 뺀다. 다른 음소 단어는 우선 단어로 지정돼도 넣지 않는다. LLM이 만든 단어를 임상 목표 단어로 저장하지 않는다.
- 안전: 아동 발화는 신뢰하지 않는 내용으로 서버 지시와 다른 메시지에 담는다. 제공자 응답은 schema·전략 일치·목표 단어 범위·금지 표현(교정·진단·치료 기법·개인정보·지시문 노출)을 서버에서 검사하고, 통과하지 못하거나 시간 초과·연결 오류면 DEMO 응답으로 대체한다. 대체 응답은 성공·실패를 기록하지 않는다. 호야의 표정·동작은 브라우저의 대화 상태(생각 중·말하는 중·듣는 중)가 정하며 LLM이 정하지 않는다. 같은 발화의 재시도는 요청 ID와 요청 내용 fingerprint로 묶여 한 turn으로만 저장되므로, 네트워크 재시도가 대화 근거를 중복으로 만들지 않는다. 응답을 잃은 turn은 복구한 호야 답을 아동에게 들려준 뒤에만 다음 발화를 받으므로, 저장된 대화 순서와 아동이 실제로 들은 대화 순서가 같다.
- 임상 분리: 대화는 별도 `HoyaChatSession`·`HoyaChatTurn`에 저장하고 `ProgressMetric`·임상 요약·활동 제안·`ClinicalObservation`에 넣지 않는다. 치료사 검증 이력도 대화 제공자에게 보내지 않는다.

### 현재 부분 구현

- 치료사 화면에는 대화 기록 보기가 아직 없다. 대화 근거는 DB에만 있다.
- DEMO 제공자는 주제 단어와 음소별 질문 목록을 쓰는 규칙 응답이다. 실제 LLM 응답 품질은 자동 테스트가 아니라 사람이 확인해야 한다(외부 호출은 가짜 transport로만 테스트했다).
- 목표 음소 "관찰"은 브라우저 ASR 문장의 문자 검출이다. 아동이 목표 음소를 정확히 산출했다는 뜻이 아니다.

### 향후 연구/검증 필요

자유대화에서의 목표 음소 산출 빈도·자연스러움, 재유도 전략의 효과, 청각 모델 단서의 적절성, 아동 반응(부담·흥미)은 검증되지 않았다. **NOT VALIDATED — NO LABELED DATA.** 대화 근거를 임상 통계에 넣으려면 치료사 검토 절차와 라벨 검증이 먼저 필요하다.

## 13. 현재 한계와 향후 임상 검증 계획

### 현재 부분 구현

음소 추정은 ASR 출력 텍스트를 단순 한국어 G2P와 동적 정렬로 비교한다. 직접 음성의 세부 조음 오류를 확정하지 못한다. `ClinicalMeaningMapper`, 정교한 cue hierarchy, 자동 휴식/대체 응답 프로토콜은 없다. Conversation Quest는 여전히 고정 DEMO 응답이며, LLM 대화는 §12의 별도 모드에서 문장 표현에만 쓴다. 임상적 `LOW`/`MEDIUM` 신뢰도는 보정된 확률이 아니다. V2의 문맥/자발화 라운드는 관찰 기회이지 일반화 성과의 증명이 아니다.

### 향후 연구/검증 필요

1. 실제 아동·치료사·기기 환경에서 동의와 윤리 심사를 전제로 음성·과제 맥락을 수집하고, 전문가 다수의 전사·목표 음소·오류 유형·cue 수준 라벨 및 의견 차이를 기록한다.
2. 아동·세션 단위로 개발/검증 자료를 분리해 ASR, VAD, 음향 지표, 목표 산출 추정의 오류율·민감도·특이도·불확실 보류율을 연령·기기·소음·방언별로 평가한다. 제품 임계값 300~2200ms와 음질 기준을 재검토한다.
3. 치료사 판단과 자동 추정의 일치·불일치 사례를 검토하고, 단어→대화 및 실제 생활로의 전이를 별도 과제로 평가한다. 사용성·안전성·부정적 피드백 영향도 함께 확인한다.
4. 필요하다면 forced alignment, GOP, wav2vec2, HuBERT, WavLM, XLS-R 등을 **향후 연구 후보**로 비교한다. 현재 제품에 구현·학습·검증된 기능이 아니다.

## 14. 참고 문헌과 코드 근거

- American Speech-Language-Hearing Association. [Speech Sound Disorders: Articulation and Phonology, Practice Portal](https://www.asha.org/practice-portal/clinical-topics/articulation-and-phonology/). 훈련 일반화, 모방 가능성, 맥락·언어 차이를 설명하는 전문 자료.
- Macrae, T. (2016). [Comprehensive Assessment of Speech Sound Production in Preschool Children](https://pubs.asha.org/doi/10.1044/persp1.SIG1.39). *Perspectives of the ASHA Special Interest Groups*, 1(1), 39–56. 복수 자료에 근거한 평가의 필요성.
- AI-Hub. [한국어 아동 음성 데이터](https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=540) 및 [데이터 이용정책](https://aihub.or.kr/intrcn/guid/usagepolicy.do?currMenu=151&topMenu=105). 후보 데이터 내용과 접근 조건.
- [The Korean Children Speech Sound Disorder (SSD) Dataset 연구](https://www.eksss.org/archive/view_article?pid=pss-16-3-87). *Phonetics and Speech Sciences*, 16(3), 2024. 한국어 아동 단어 음성 연구 후보; 원자료 허가는 별도 확인 필요.
- K-Univ. [Speech Database of Typically Developing and Speech-Impaired Children](https://huggingface.co/datasets/K-Univ/Pathological-child-voice). 공개 배포 페이지에 기재된 내용과 이용 조건만 후보 판단에 사용.
- 저장소 근거: [게임 정의·평가](../../backend/app/games/rounds.py), [음향·발화 분석](../../backend/app/speech/pipeline.py), [관찰·검증](../../backend/app/clinical/observation_builder.py), [브라우저 VAD](../../src/speech/vad.ts), [R4 마이크 fixture](../../shared/re_onset_mic_cases.json), [검증 기록](VALIDATION_REPORT.md).
