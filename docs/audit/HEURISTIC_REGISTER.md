# Heuristic 기준값 목록

Phase 0 감사에서 찾은, 코드에 고정된 행동·임상·제품 기준값이다. 값은 `origin/main` 6ee9c54 기준이며 위치는 파일과 함수(또는 상수)로 적었다.

**출처 분류**

| 분류 | 의미 |
|---|---|
| RESEARCH_SUPPORTED | `docs/references/SPEECH_HERO_EVIDENCE_SOURCES.md`나 코드가 그 정확한 값을 근거로 제시한 경우만 해당 |
| PRODUCT_HEURISTIC | 코드나 문서가 제품 규칙이라고 밝힌 경우 |
| TECHNICAL_LIMIT | 기술적 제약에서 나온 값 |
| UNKNOWN | 근거를 확인할 수 없는 값. 없는 근거를 지어내지 않았다 |

**요약**

- RESEARCH_SUPPORTED로 분류한 값은 **0개**다.
- 근거 문서에는 음향·점수 기준값이 없다.
- 시도 횟수 30회는 근거 문서가 회기당 약 30회가 흔하다고 언급하지만(McFaul 2022 절), 고정 기준으로 쓰지 말라고 경고한다(2-2절, 9절). 그래서 UNKNOWN으로 분류했다.
- 사용자 결정: 수치 수정은 나중 Phase에서 한다. 이 목록은 기록이며 변경을 승인한 것이 아니다.

## 1. 음성 입력(프런트엔드)

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| 시작 여유 12dB, 종료 여유 6dB, 바닥 -50dB, 시작 유지 60ms, 종료 유예 700ms, 계속 100ms, 최대 8000ms | `src/speech/vad.ts`의 `DEFAULT_VAD` | VAD | TECHNICAL_LIMIT / UNKNOWN |
| 초기 잡음 바닥 -60dB, 중앙값 보정 | `src/speech/vad.ts` | VAD | TECHNICAL_LIMIT |
| 보정 1000ms | `src/speech/micUtterance.ts`의 `CALIBRATION_MS` | 잡음 기준 | TECHNICAL_LIMIT |
| fftSize 2048, frame 20ms | `src/speech/audioCapture.ts` | 캡처 | TECHNICAL_LIMIT |
| HF 대역 4000–8000Hz, 클리핑 \|s\| ≥ 0.99 | `src/speech/features.ts` | 특징 추출 | UNKNOWN |
| HF 비율 0.35, centroid 3000Hz, 여유 6dB, 간격 120ms | `src/speech/thresholds.ts` | 마찰음·지속 판정 | UNKNOWN(주석에 "보정 전 기본값"이라고 적혀 있음) |
| centroid < 2000Hz이면 유성음 | `src/speech/fricativeDetector.ts` | 전이 판정 | UNKNOWN |
| 가청 +6dB, 에너지 평활 0.75/0.25, 30dB 척도, 구간 최대 30개 | `src/speech/sustainTracker.ts` | 지속·에너지 | UNKNOWN |
| ASR 종료 timeout 3000ms, 대체 후보 5개 | `src/speech/webSpeechRecognizer.ts` | 인식 | TECHNICAL_LIMIT |
| '네 차례' 차임 뒤 듣기: 차임 끝 290ms + 조용히 160ms = 450ms, 기기 출력 지연(`outputLatency`)만큼 더, 최대 1000ms | `src/child/demoFx.tsx`의 `TURN_CUE_MS`·`turnCueWait` | 차임이 마이크에 들어가 아이 말로 잡히지 않게 듣기를 늦춤(2026-10-05 Phase 4) | TECHNICAL_LIMIT(헤드리스 시간 측정. 실제 스피커·방 울림은 리허설에서 확인) |
| 귀 쫑긋 380ms, 머리 세로 +15%(절차형 모델은 귀 +32%) | `src/tiger/duduPerk.ts` | '네 차례' 연출(임상 무관) | PRODUCT_HEURISTIC |
| 게임 4종 반응 시간(`onsetLatencyMs`)은 듣기가 열린 때('네 차례!')부터 | `src/child/ActivitySession.tsx` | 측정 요약(판정·지표에 쓰지 않음) | PRODUCT_HEURISTIC |

## 2. 음질·음향(백엔드, 일부는 TS에 중복)

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| 클리핑 ≥ 0.01, 길이 < 300 또는 > 8000ms, SNR < 8이면 POOR. 잡음 바닥 > -35이면 NOISY. SNR ≥ 15이면 GOOD | `backend/app/pronunciation/audio_quality.py`의 `assess_audio_quality`(TS 사본 `src/speech/audioQuality.ts`와 이미 어긋남) | 음질 게이트 | UNKNOWN |
| bestRun ≤ duration + 200ms, frication ≤ active + 40ms | `pronunciation/acoustic.py`의 `AcousticSummary` 검증 | 입력 정합성 | TECHNICAL_LIMIT |
| 0–60000ms, dB -160–20, SNR -100–180 | `pronunciation/acoustic.py` | schema 범위 | TECHNICAL_LIMIT |

## 3. 발음 분석과 판정

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| 빔 목표 기본 1500ms | `speech/pipeline.py` | 빔 목표 | UNKNOWN |
| 키보드 입력: run ≥ 0.8 × 목표 | `speech/pipeline.py`의 `analyze` | DEMO 통과 | UNKNOWN |
| run ≥ 0.8 × 목표이고 frication ≥ 0.6 × active | `speech/pipeline.py`, `games/evaluation.py`(중복) | 마찰음 통과 | UNKNOWN |
| 유사 음소 비용 0.5, 목표 음소 가중치 ×3 | `speech/alignment.py`, `speech/pipeline.py` | 점수 | UNKNOWN |
| 합격 점수: accuracy 85, balanced 75, speed 70 | `speech/pipeline.py` | 단어 성공 | UNKNOWN(치료사가 `pass_threshold`로 덮어쓸 수 있음) |

## 4. 5라운드 엔진(V2)

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| CONTINUITY: 끊김 ≤ 1 | `games/evaluation.py`의 `evaluate_round` | 라운드 통과 | UNKNOWN |
| PULSES: 목표(500ms) 이상 구간 ≥ 3개 | `games/evaluation.py`, `games/rounds.py` | 라운드 통과 | UNKNOWN |
| TRANSITION: onset ≥ 400ms이고 voicedAfter ≥ 200ms | `games/evaluation.py`, `games/rounds.py` | 라운드 통과 | UNKNOWN |
| ENERGY_BAND 0.35–0.75 | `games/evaluation.py` | 라운드 통과 | UNKNOWN |
| RE_ONSET: 쉼 300–2200ms, 구간 ≥ 2개 | `games/rounds.py`, `games/evaluation.py` | 쉼 후 재개 | 상한은 TECHNICAL_LIMIT(종료 유예보다 짧아야 함), 하한은 UNKNOWN |
| 종료 유예: RE_ONSET 2500ms, 기본 700ms, PULSES 1200ms | `games/rounds.py`(TS `vad.ts`와 `public_round`에 손으로 옮긴 사본 있음) | 발화 끝 판정 | TECHNICAL_LIMIT |
| 라운드 목표: 빔 1000/1500/2000/500/400, 하늘 1000/1500/1500/1000/2500 | `games/rounds.py`의 `GAME_ROUNDS` | 라운드 목표 | UNKNOWN |
| 라운드별 시도 횟수: 3/3/3/3/3, 3/4/3/5/6, 3/3/3/3/2, 2×5 | `games/rounds.py` | 시도 수 | UNKNOWN |
| 제한 시간 60초(대화 90초) | `games/rounds.py` | 라운드 timeout | UNKNOWN |
| 난이도 배율 1 + 0.15×(d−2), 800–3500ms 범위, d는 1–5, 시작값 2 | `games/rounds.py`의 `effective_round`, `main.py`의 `start_activity` | 난이도 조정 | UNKNOWN |
| 성공 비율 ≥ 2/3이고 올림 < 2회면 올림. 성공 비율 ≤ 1/3이 2회면 한 번만 내림 | `games/rounds.py`의 `next_difficulty` | 난이도 규칙 | UNKNOWN |
| 다시 듣기 ≥ 2회면 중립 건너뛰기 | `main.py`의 `activity_utterance` | 불확실 처리 | UNKNOWN |
| 대구대 건너기 ONSET_FRICATION: 시작 마찰 ≥ 60ms(2026-10-06 70→60)이고 마찰 뒤 유성 ≥ 80ms. 시작 마찰을 잴 때 앞부분 60ms(2026-10-06 40→60)·도중 20ms 꺼짐을 봐준다. 잡음보다 15dB 미만이면 불확실(공용 음질 기준 8dB보다 엄격) | `games/evaluation.py`의 `ONSET_FRICATION_MS`·`VOICED_AFTER_FRICATION_MS`·`ONSET_MIN_SNR_DB`. 화면 사본 `src/game/crossing/crossingFlow.ts`의 `ONSET_RULE` | 줄 통과(음향 근사) | PRODUCT_HEURISTIC. 2026-10-05 성인 1명 PC 마이크 실측 2회(정답 확인 포함): 바른 '사' 60~99ms, '차·자' 39~59ms. 2026-10-06 아이폰에서 바르게 말한 '사과'가 자주 '다시'가 되어 한 칸 내림(사용자 요청). 3프레임 '차·자'가 가끔 통과할 수 있음. 임상 검증 아님([MIC_MEASUREMENT](../handoff/MIC_MEASUREMENT_2026-10-05.md)) |
| 대구대 건너기 진행: 5라운드 × 2줄, 줄당 최대 3번 시도, 불확실·무발화는 시도를 쓰지 않고 같은 줄에서 연속 3번이면 중립 이동 | `games/crossing.py` | 진행 | PRODUCT_HEURISTIC(사용자 결정 2026-10-05) |
| 건너기 화면 발화 감지: 시작 여유 9dB, 바닥 -56dB, 앞부분 되살리기 최대 400ms, 시작 마찰 앞 40ms·도중 20ms 봐주기 | `src/game/crossing/onsetPipeline.ts` | 조용한 /ㅅ/ 감지 | PRODUCT_HEURISTIC(실측: 조용한 '스'를 놓침, 숨소리 한 프레임에 시작 마찰 0) |
| 건너기 속도: 말풍선 접근 5000ms·말하기 창 4000ms에서 시작, 최소 2500/2500. 최근 8번 중 7번 성공이면 0.5초씩(한 번에 하나), 2번 연속 어려우면 느리게 | `src/game/crossing/crossingFlow.ts`의 `nextPace` | 속도 조절 | UNKNOWN |
| '딱 맞았어!' 창: 카드가 동그라미에 든 뒤 1.5초 안에 말 시작 | `src/child/DaeguCrossing.tsx`의 `ON_TIME_MS` | 화면 연출(임상 자료 아님) | PRODUCT_HEURISTIC |

## 5. legacy 훈련 정책(기존 모험)

2026-10-04 기존 모험과 함께 `training/policy.py`·`plan_generator.py`를 삭제했다. 아래 값은 과거 회기 해석을 위한 기록이다. 배지 규칙(마지막 줄)만 완료 처리에서 계속 쓴다.

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| 빔 성공 시 +500(최대 4000). run < 0.5 × 목표면 −300(최소 800). 시도 ≥ 3이면 건너뜀 | `training/policy.py`의 `decide` | 빔 적응 | UNKNOWN |
| 연속 성공 3회(speed는 2회)면 단계 올림 | `training/policy.py` | 단계 올림 | UNKNOWN |
| 목표 재시도 3회(speed는 4회)면 단계 내림, 쉬운 항목 3개 삽입 | `training/policy.py` | 단계 내림 | UNKNOWN |
| 최대 시도 3회(speed는 2회), 3번째에 힌트 | `training/policy.py` | 재시도·단서 | UNKNOWN |
| XP 10(첫 시도 +5), 노력 2 | `training/policy.py` | 보상 | PRODUCT_HEURISTIC(암묵적) |
| 시도 ≥ repetition_target이거나 시간 도달이면 종료 | `training/policy.py` | 세션 종료 | UNKNOWN |
| 이전 levelDownCount ≥ 2면 warm-up. 음절 3개와 항목 5개, 빔 3개. 시간 > 5분이면 3단계 | `training/plan_generator.py` | 실행 계획 | UNKNOWN |
| 배지: 빔 ≥ 3, 노력 ≥ 5. 레벨 = xp // 100 | `training/rewards.py`, `main.py` | 보상 | PRODUCT_HEURISTIC(암묵적) |

## 6. 목표 기본값

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| repetition_target 기본 30(범위 10–60) | `schemas.py`의 `GoalInput`, `models.py`의 `TrainingGoal` | 목표 시도 | UNKNOWN(근거 문서는 관행으로만 언급하고 고정 기준 사용을 경고함) |
| 세션 시간 5/10/15분, 기본 10분 | `schemas.py`, `models.py` | 목표 시간 | UNKNOWN |

## 7. 추천·제안

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| R1: 재시도 > 0.4이거나 단계 내림 있음. R2: 이번 회기 첫 시도 ≥ 80이고, 최근 완료 세션 3개 중 같은 단계 세션에서도 1회 이상 ≥ 80. R3: 시도 ≥ 3이고 평균 < 60. R4: 힌트/항목 > 0.3. R5: fallback. 최대 2개 | `analysis/recommendation.py`의 `recommend` | legacy 추천 | UNKNOWN |
| confidence: 최근 완료 세션 3개를 조회한 뒤 같은 단계이면서 activity가 아닌 세션만 남김. R1은 1 + (그중 재시도율 > 0.4인 세션 수), 나머지 규칙은 1 + (남은 세션 수). 합이 ≥ 3이면 high, ≥ 2면 medium, 그 외 low | `analysis/recommendation.py`의 `recommend` | legacy 신뢰도 | UNKNOWN |
| insight 차이 ≥ 15%p | `analysis/insights.py` | insight 문장 | UNKNOWN |
| 최근 10건. SOUND ≥ 2건이고 평균 bestRun < 1500이면 빔. 단어 ≥ 2건이고 성공 ≤ 50%면 몬스터. 검증 ≥ 5건이면 MEDIUM | `clinical/activity_recommendation.py`의 `propose_activity` | 활동 제안 | UNKNOWN |
| 관찰 confidence: 결과가 uncertain/no_speech면 UNCERTAIN. DEMO나 target_observed면 LOW. 음질 GOOD이면 MEDIUM, 그 외 LOW | `clinical/observation_builder.py`의 `build_observation` | 관찰 신뢰도 | UNKNOWN |

## 8. 치료사 회기 계획

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| MIN_EVALUABLE 5 | `therapist_planning/evidence.py` | 자료 충분 여부 | UNKNOWN(작성 당시 제품 판단이었고 근거 문서에 없음) |
| RECENT_SESSION_WINDOW 5 | `therapist_planning/evidence.py` | 근거 범위 | UNKNOWN |
| 목표 단계 성공률 < 50%면 한 단계 낮게 시작. ≥ 80%면 다음 단계 검토 안내(목표는 자동으로 바꾸지 않음) | `therapist_planning/proposal.py`의 `propose_plan` | 제안 규칙 | UNKNOWN |
| 불확실+무발화 ≥ 30%면 녹음 확인 안내 | `therapist_planning/proposal.py` | 제안 규칙 | UNKNOWN |
| step 구성: 대화 2분 → 게임 → 대화 2분 | `therapist_planning/proposal.py` | 기본 활동 순서 | UNKNOWN |
| 요약 timeout 10초, 출력 400자·근거 6개·한계 4개, 근거 목록 20개 | `config.py`, `therapist_planning/summary.py`, `api.py` | LLM 제한 | TECHNICAL_LIMIT |

## 9. 호야 대화

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| 최대 30턴, 제공자 timeout 8초, stale 30초 | `config.py` | 대화 제한 | TECHNICAL_LIMIT / UNKNOWN |
| 응답 120자, 질문 부호 ≤ 1개, 최근 5턴 context | `hoya/validator.py`, `hoya/prompt/*` | 응답 형식 | UNKNOWN |
| 같은 UNCERTAIN이 반복되면 SIMPLIFY. TARGET_NOT_OBSERVED가 반복되면 단서 허용 | `hoya/policy.py` | 전략 | UNKNOWN |
| "음..." 지연 750ms | `src/child/hoyaChatController.ts`의 `HOYA_THINKING_FILLER_DELAY_MS` | UX | UNKNOWN |
| 게임 전환: 목표 관찰(TARGET_OBSERVED) 턴 ≥ 10이고 서버 시간 ≥ 120초, 또는 ≥ 300초, 또는 무발화 연속 4턴(3턴째에 쉬운 질문 먼저). 관찰 횟수는 발음 정확도가 아니다 | `hoya/transitions.py` | 대화 → 대구대 건너기 안내 | PRODUCT_HEURISTIC(사용자 데모 흐름 승인 2026-10-05: 약 10번·약 5분) |
| 시작 문구 "안녕~ 만나서 반가워! {별명}아/야. 나는 두두야. 오늘 뭐 하고 놀았어?"(받침에 따라 아/야), 전환 문구 "우리 게임 해 볼까? 아래 '대구대 건너기'를 눌러 볼래?" | `hoya/providers/demo_provider.py`의 `opening_text`, `hoya/transitions.py`의 `TRANSITION_TEXT` | 대본 | PRODUCT_HEURISTIC |
| DEMO /ㅅ/ 대본(2026-10-06): 아이 말의 주제에 반응한 뒤 /ㅅ/ 낱말이 나오기 쉬운 질문을 한다. 순서는 주제 질문 → 같은 주제로 이어 가는 질문 → 어디에나 맞는 질문이고, 최근 3번 안에 한 질문과 아이가 방금 말한 낱말을 묻는 질문은 건너뛴다. 같은 주제 반응은 연달아 하지 않는다. 목표 관찰이면 알려진 낱말을 바르게 다시 들려준다("맞아, 사과!") | `hoya/providers/demo_provider.py`의 `TOPICS`·`S_FOLLOW_UPS`·`S_ANYWHERE`·`RECENT_QUESTIONS` | 자연스러운 /ㅅ/ 유도 | PRODUCT_HEURISTIC(사용자 지적: 대놓고 고르게 하는 질문은 부자연스럽다, 2026-10-05·아이폰 시험 2026-10-06) |
| DEMO 돕기: 이번 말과 바로 앞 말에 목표 음소가 없을 때(서버 대화 근거와 같은 규칙) 4턴째부터 돕는다. 같은 낱말로 고르기 → 빈칸 → 먼저 들려주기(치료사 허용 시) 순서로 단서를 늘린다. 첫 3턴에는 서버가 ALLOWED_CUE를 줄 때 먼저 들려주기만 한 번 한다. 낱말은 지금 주제·바로 앞 질문과 이어지는 것을 먼저 고르고, '소리'는 문장이 어색해 돕는 낱말에서 뺀다. 무발화 3번(그림 고르기)·불확실 2번(고르기)은 정책(SIMPLIFY) 그대로라 첫 3턴에도 나올 수 있다 | `hoya/providers/demo_provider.py`의 `HELP_FROM_TURN`·`S_HINTS`·`HELP_SKIP` | 도움이 필요할 때만 단서 | PRODUCT_HEURISTIC |
| 두두 음성 파일: 말의 모든 문장이 목록에 있을 때만 파일 재생(아니면 전부 브라우저 음성), 문장 사이 120ms | `src/speech/duduClips.ts`, `shared/dudu_voice_lines.json` | 목소리 일관성 | PRODUCT_HEURISTIC |
| 입 모양 맞추기: 40ms 간격 소리 크기, 최대보다 30dB 아래는 닫힘, 0~9 단계 | `scripts/build-voice-envelopes.mjs`, `shared/dudu_voice_envelopes.json`, `src/tiger/duduFace.ts` | 말하는 입 연출(임상 무관) | PRODUCT_HEURISTIC |

## 9-1. 대구대 건너기 리듬 (2026-10-05)

리허설 관찰로 조정할 제품 규칙이다. 박 맞춤은 동기용 연출이고 임상 지표가 아니다.

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| 카드 1장 = 4박 한 마디. 1~3박에 '똑'(90ms), 4박에 카드 착지 | `src/game/crossing/rhythm.ts`의 `bar` | 말할 때 알리기 | PRODUCT_HEURISTIC |
| 시작 84BPM. 치료사 설정 76~100(기본 84, 빨라지기 켬) | `rhythm.ts`의 `DEFAULT_RHYTHM`·`BPM`, `backend/app/game_settings/schemas.py` | 빠르기 | PRODUCT_HEURISTIC(느리게 시작하는 원리는 DTTC·ReST, 값 자체의 근거는 없음) |
| 최근 8번 중 7번 성공이면 +4BPM(최대 100, 빨라지기 끄면 시작값), 연속 2번 성공이 아니면 −4BPM(최소 72). 바뀌면 기록을 비움 | `rhythm.ts`의 `nextBpm` | 빠르기 맞춤 | PRODUCT_HEURISTIC |
| 마이크 열림 = 3박 '똑' + 여운 160ms + 출력 지연(최대 400ms). 착지보다 늦지 않음 | `rhythm.ts`의 `bar` | 박 소리가 마이크에 잡히지 않게 | TECHNICAL_LIMIT |
| 듣기 창 = 착지 + 4박(말이 시작됐으면 최대 4초) | `rhythm.ts`의 `WINDOW_BEATS` | 대답 시간 | PRODUCT_HEURISTIC |
| '딱 맞았어!' = 착지 앞 300ms~뒤 400ms. 화면에만 보이고 저장하지 않음 | `rhythm.ts`의 `PERFECT_EARLY_MS`·`PERFECT_LATE_MS` | 동기 | PRODUCT_HEURISTIC |
| 두두 부르기: 음성 파일을 착지 − 모음 시작('사!'는 200ms) − 40ms에 재생 | `rhythm.ts`의 `beatLeadMs` | 시범을 박에 맞춤 | PRODUCT_HEURISTIC |

## 10. 변경할 때의 규칙

- 값을 바꾸면 이 표를 함께 고친다. 출처를 RESEARCH_SUPPORTED로 올리려면 근거 문서의 해당 절을 인용해야 한다.
- Python과 TS 사본(음질, 종료 유예, 빔 규칙)은 한쪽만 바꾸지 않는다.
- 임상에 영향을 주는 값(`CLINICAL_SENSITIVE`)을 바꾸려면 사용자 승인이 필요하다.
