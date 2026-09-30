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

## 2. 음질·음향(백엔드, 일부는 TS에 중복)

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| 클리핑 ≥ 0.01, 길이 < 300 또는 > 8000ms, SNR < 8이면 POOR. 잡음 바닥 > -35이면 NOISY. SNR ≥ 15이면 GOOD | `backend/app/pronunciation/audio_quality.py`의 `assess_audio_quality`(TS 사본 `src/speech/audioQuality.ts`와 이미 어긋남) | 음질 게이트 | UNKNOWN |
| bestRun ≤ duration + 200ms, frication ≤ active + 40ms | `pronunciation/acoustic.py`의 `AcousticSummary` 검증 | 입력 정합성 | TECHNICAL_LIMIT |
| 0–60000ms, dB -160–20, SNR -100–180 | `pronunciation/acoustic.py` | schema 범위 | TECHNICAL_LIMIT |

## 3. 발음 분석과 판정

| 값 | 위치 | 용도 | 출처 |
|---|---|---|---|
| 빔 목표 기본 1500ms | `speech/pipeline.py`, `training/content.py`, `training/policy.py` | 빔 목표 | UNKNOWN |
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
| 다시 듣기 ≥ 2회면 중립 건너뛰기 | `training/policy.py`, `main.py`의 `activity_utterance` | 불확실 처리 | UNKNOWN |

## 5. legacy 훈련 정책(기존 모험)

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

## 10. 변경할 때의 규칙

- 값을 바꾸면 이 표를 함께 고친다. 출처를 RESEARCH_SUPPORTED로 올리려면 근거 문서의 해당 절을 인용해야 한다.
- Python과 TS 사본(음질, 종료 유예, 빔 규칙)은 한쪽만 바꾸지 않는다.
- 임상에 영향을 주는 값(`CLINICAL_SENSITIVE`)을 바꾸려면 사용자 승인이 필요하다.
