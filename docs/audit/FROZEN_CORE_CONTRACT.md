# Frozen Core 계약

Phase 0에서 사용자(제품 소유자)가 승인했다(2026-09-30). 이후 모든 Phase는 이 계약을 지킨다.
근거가 된 감사 내용은 `PRODUCT_REALITY_MATRIX.md`에 있다.

## 1. 원칙

- **동결 대상은 계약이다.** 경로, schema, 상태 값, 함수 signature, 보안 동작을 동결한다. heuristic 수치와 알고리즘은 동결하지 않는다(`HEURISTIC_REGISTER.md`).
- **동결 경로를 수정하려면 먼저 사용자 승인을 받는다.** 요청에는 다음을 적는다.
  - 바꿀 파일
  - 이유
  - 계약에 주는 영향
  - 회귀 명령
- 승인 없이 수정했다면 `FROZEN_CORE_VIOLATION`으로 보고한다. 되돌리기 전에 먼저 사용자에게 알린다.
- DB 표와 열 이름은 바꾸지 않는다. 마이그레이션 도구가 없어서 이름을 바꾸면 기존 DB가 깨진다.

## 2. 동결 경로

| 경로 | 등급 | 동결하는 계약 | 허용 예외(승인이 있으면 가능) |
|---|---|---|---|
| `backend/app/auth.py` | FREEZE_WITH_EXCEPTIONS | 쿠키 `speech_hero_session`(`path=/api`, HttpOnly, SameSite Strict, `secure=settings.cookie_secure`)을 유지한다. GET·HEAD·OPTIONS가 아닌 요청은 `X-CSRF-Token` 해시를 비교한다. `require_student -> Account`, `require_therapist -> Therapist`, `require_admin -> Account`의 signature를 유지한다. `owned_child(db, child_id, therapist) -> Child`는 다른 치료사의 아동에 대해 404를 반환하고 `ACCESS_DENIED` 감사 기록을 남긴다. 응답 코드: 세션 없음·만료 401, CSRF·역할 실패 403 | 만료 세션 정리, 세션 회전, `require_child_access` 삭제(정리 PR에서 승인됨) |
| `backend/app/security.py` | FREEZE_WITH_EXCEPTIONS | `hash_password(password: str, salt: str)`(salt는 hex 문자열)는 PBKDF2-SHA256 20만 회를 유지한다. 기존 해시가 이 값에 의존한다. `verify_password`는 상수 시간 비교를 유지한다. `hash_token`은 SHA-256 hex를 유지한다. 계정이 없을 때 dummy 해시 비용을 쓰는 동작을 유지한다 | `issue_token` 삭제(정리 PR에서 승인됨). 해시 알고리즘을 바꾸려면 호환 upgrade 경로가 있어야 함 |
| `backend/app/db.py`, `backend/app/models.py` | FREEZE_WITH_EXCEPTIONS | 기존 표 이름과 열 이름, 의미를 유지한다. `TrainingGoal`(장기 목표, 버전 행), `TherapistSessionPlan`(다음 한 회기), `TrainingPlan`(실행 계획)의 의미는 서로 분리된 채로 유지한다. `collection_json`에는 비임상 상태만 둔다 | 새 표나 새 nullable 열 추가, 인덱스 추가, Alembic 도입(PostgreSQL 이전 전에 필수), `AuthToken` 모델은 삭제하지 않고 유지 |
| 소유권·CSRF 로직(모든 치료사·학생 route) | FREEZE_RECOMMENDED | 특정 아동이나 그 아동에 속한 자원(세션, 관찰, 추천, 규칙, 계획 등)을 다루는 치료사 route는 `owned_child`를 거친다. 목록·생성 route(`GET/POST /api/children`, `/api/dashboard/overview`)는 `Child.therapist_id == therapist.id`로 조회하거나 현재 치료사로 생성한다. 학생 route는 `account.child_id`와 비교한다(`play_session`, `hoya/api.py`의 `_owned`, `play_profile`). 계획은 항상 아동을 거쳐 조회한다(`therapist_planning/api.py`의 `_owned_plan`) | 없음 |
| `main.py`의 보안 미들웨어 | FREEZE_WITH_EXCEPTIONS | Origin 검사(403), Content-Length 검증(400), 64KiB 본문 제한(413), 보안 헤더(CSP, XFO DENY, nosniff, Referrer-Policy, Cache-Control) | HSTS·Permissions-Policy 추가, trusted proxy IP 처리, `child_code`를 기관별 또는 무작위로 생성 |
| `backend/app/hoya/**` | FREEZE_WITH_EXCEPTIONS | 경로: `POST /api/hoya/chat/sessions`, `GET /api/hoya/chat/sessions/{id}`, `POST .../turns`(200/202/409, `turnIndex`와 `clientRequestId` 필수), `POST .../complete`. schema: `HoyaChatTurnInput`, `ProviderOutput`, `HoyaDialogueResponse`. 값: `SpeechEvidence`(TARGET_OBSERVED, TARGET_NOT_OBSERVED, UNCERTAIN, NO_SPEECH), `Strategy`, 제공자 라벨 DEMO/DEMO_FALLBACK/OPENAI. 규칙: 제공자에게 도구를 주지 않고 재시도하지 않는다. 아동 발화는 신뢰하지 않는 입력으로 분리한다. TARGET_OBSERVED를 정확한 발음으로 취급하지 않는다 | heuristic 값(3절)은 조정 가능 |
| `backend/app/therapist_planning/**` | FREEZE_WITH_EXCEPTIONS | `docs/therapist-workflow.md` 6절의 경로 9개와 `SessionPlanInput`, 응답 필드. 상태: DRAFT, APPROVED, SUPERSEDED, CANCELLED. APPROVED는 변경할 수 없고 clone으로만 revision을 만든다. 승인 시 스냅숏을 남긴다. `SummaryOutput` 4개 필드. 근거 필터: REAL이고 seed가 아니며 마지막 결정이 confirm/correct인 관찰만 쓴다. UNCERTAIN, NO_SPEECH, POOR는 평가 가능 시도에서 뺀다. LLM은 계산이나 결정을 하지 않는다. `nextSessionSuggestion`에는 서버가 만든 문장을 쓴다. LLM context에서 식별 정보를 뺀다. rationale 코드 | heuristic 값(3절)은 조정 가능 |
| `backend/app/speech/**`, `backend/app/pronunciation/**` | FREEZE_WITH_EXCEPTIONS(interface만) | `AcousticSummary`의 필드와 camelCase alias, `extra="forbid"`, `source`(keyboard 또는 microphone). `UtteranceInput`. `AnalysisResult`. `analyze(item, transcript, acoustic, goal, rules=())`. `assess_audio_quality(...) -> {level, snrDb, reasons}`와 등급 GOOD/FAIR/POOR/UNKNOWN. 결과 어휘: success, retry, no_speech, uncertain, target_observed, not_target_attempt. `Phone`, `Operation`, `SimpleKoreanG2P.to_phonemes`, `align`, `normalize`의 signature. pattern tag 이름 | 알고리즘과 수치는 동결하지 않음(G2P 규칙, 유사 음소 비용, ×3 가중치, 85/75/70, 0.8/0.6, 음질 기준값, 허용 오차) |
| `backend/app/clinical/**` | DO_NOT_FREEZE(아래 계약만 예외로 동결) | 동결 대상: 검증 상태 값(PENDING, CONFIRMED, CORRECTED, REJECTED, DEMO_*), ClinicalVerification이 append-only라는 점, 관찰 응답의 `is_demo`와 `clinical_eligible` 필드 | `is_seed` 누락 수정(Phase 1), 활동 제안 규칙과 수치 변경 |

## 3. 동결하지 않는 heuristic(대표 목록)

전체 목록은 `HEURISTIC_REGISTER.md`에 있다. 아래 값은 조정할 수 있지만, 바꿀 때는 register를 함께 갱신하고 사용자에게 알린다.

- **회기 계획:** MIN_EVALUABLE 5, 최근 회기 창 5개, 50%·80% 기준, 녹음 확인 30%, `MAIN_GAME_BY_LEVEL`, 대화 step 2분, 요약 timeout 10초, FORBIDDEN 목록, `evidence[:20]`
- **호야 대화:** 최대 30턴, timeout 8초, stale 30초, 120·80자 제한, `RECENT_TURNS` 5, 금지 표현 regex, `TOPICS` 표, `CHAT_ALLOWED_CUES`
- **활동 제안:** 최근 10건, 1500ms, 50% 이하, MEDIUM 기준 5건

## 4. Mutable Quality Zone(시각·제품 품질 개선 대상)

| 경로 | 등급 | 지켜야 할 제약 |
|---|---|---|
| `src/styles/**` | SAFE_TO_REDESIGN | tsx에서 쓰는 class 이름을 유지하거나 tsx와 함께 바꾼다: `child-screen`, `game-screen`, `target`, `small`, `big-button`, `card`, `grid`, `speech-bubble`, `quiet`, `therapist-screen`, `workspace-tabs`, `summary-grid`, `notice`, `muted`, `chart-wrap`. 치료사 class는 `workspace.test.tsx`가 확인한다. CSP 때문에 외부 폰트나 CDN은 쓸 수 없고 자체 호스팅해야 한다 |
| `src/pages/**` | SAFE_TO_REDESIGN | `/play`와 `/therapist/login` 링크를 유지한다 |
| `src/character/**` | 삭제됨(2026-10-04) | legacy 모험 제거(로드맵 5절 3번)와 함께 `Character.tsx`·`tts.ts`를 지웠다. 폴더가 없다 |
| `src/tiger/**` | SAFE_WITH_INTERFACE_CONSTRAINTS | `<Hoya3D action className>`, `HoyaAction` 17개 값(THINKING 포함) 처리, `HoyaFallback`과 `data-hoya-fallback="true"`, `ACTION_TEXT` 문구(테스트가 확인), fallback에 "3D" 문구를 쓰지 않을 것, `canUseWebGL`, `HoyaErrorBoundary`, context loss fallback, 높이는 부모가 정하는 구조를 유지한다. 내부 `Tiger` 메시는 교체할 수 있다. GLB loader를 도입하거나 의존성을 추가하려면 사용자 승인이 필요하다(2026-10-04 승인: three 내장 `GLTFLoader`로 `public/assets/dudu/dudu.glb`를 읽는다. `EXT_texture_webp`·`KHR_mesh_quantization`만 쓰고 meshopt·Draco·KTX2 디코더는 쓰지 않는다. 로딩 실패 시 절차형 모델로 돌아간다) |
| `src/child/**`(화면층) | SAFE_WITH_INTERFACE_CONSTRAINTS | sessionStorage 키(`speechHero.code`, `speechHero.activity`, `speechHero.result`. legacy 모험용 `speechHero.play`는 2026-10-04 삭제), API 호출, `detectCapabilities`·`supportsRealMode`·`missingText` 게이트, Space와 pointer 입력 핸들러, TTS 중 마이크 차단 ref(`modelSpeaking`, `submitting`), `HoyaActionController`의 dispatch 지점, `aria-live` 영역, DEMO 고지 문구를 유지한다 |
| `src/game/**` | SAFE_WITH_INTERFACE_CONSTRAINTS | V2 게임 장면은 새 코드로 작성한다. legacy 상태 기계(`beamTransition`, `towerTransition`)와 `BeamCanvas`는 사용처가 legacy 모험뿐이라 2026-10-04 함께 삭제했다(로드맵 5절 3번) |
| `public/assets/**` | SAFE_TO_REDESIGN(신규) | 같은 출처에서 제공한다. 에셋 출처와 라이선스, 대구대 마스코트 IP는 사용자가 확인한다 |
| `src/child/**`(음성 로직), `hoyaChatController.ts`, `src/control/**`, `src/speech/**` | HIGH_RISK_TO_TOUCH | 캡처→파이프라인→인식기→제출 순서, `CALIBRATION_MS`, `mapSignalToHoya`(THINKING을 반환하지 않음). 수정하려면 사용자 승인과 해당 테스트가 필요하다 |

## 5. 승인된 정리 작업(Phase 0.5) — 2026-10-04 실행

사용자 승인(2026-09-30)에 따라 Phase 0 문서 PR과 분리해서 진행한다.

- `src/character/dialogue.ts` 삭제. 사용처가 없고 루미·legacy 표현이 남아 있다. (실행 시 확인: PlaySession은 `lines.ko.ts`를 더 이상 쓰지 않아 함께 삭제했다.)
- `backend/app/security.py`의 `issue_token` 삭제. 쿠키 인증 이후 쓰이지 않는다. `AuthToken` 모델과 표는 유지한다.
- `backend/app/auth.py`의 `require_child_access` 삭제. 쓰이지 않고, 감사 기록과 테스트가 없으며 ADMIN을 그대로 통과시킨다. Phase 7에서 필요해지면 감사 기록과 테스트를 갖춰 다시 설계한다.

나머지 legacy 경로(기존 모험, legacy AI 추천, ActivityRecommendation, `/progress` 그래프)는 사용자 결정에 따라 각 Phase를 진행하며 처리한다. 후보와 충돌 지점은 `LEGACY_AND_PLACEHOLDER_REGISTER.md`에 있다. 기존 모험은 2026-10-04 사용자 승인(로드맵 5절 2·3번)으로 삭제했다.

## 6. 회귀 명령

동결 경로를 수정했거나 Phase를 마칠 때는 아래를 모두 실행한다. 실행하지 않은 항목을 PASS라고 보고하지 않는다.

```powershell
backend\.venv\Scripts\python.exe -m pytest backend -q
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
backend\.venv\Scripts\python.exe backend\scripts\smoke_api.py   # 실행 중인 서버(SEED_DEMO_DATA=true, COOKIE_SECURE=false) 대상
git diff --check
npm.cmd audit
```

이 명령들은 logic, API, 정적 렌더만 검증한다. 시각 품질, 실제 마이크, 실제 LLM, 임상 타당성은 별도로 수동 검증하고, 그 결과를 사용자가 승인해야 한다.

## 7. 승인된 Phase 순서

1. **Phase 1, 임상 무결성:** `is_seed` 누락 수정과 테스트, legacy·DEMO 지표를 분리하거나 표시 — **완료(2026-10-04 `main` 병합)**. 과거 행 수리는 별도 결정
2. **Phase 2, 명칭·표기:** 루미 제거, "AI" 명칭 정리, heuristic 라벨
3. **Phase 3, 시각 방향과 에셋 결정:** 호야 캐릭터 에셋, IP, 디자인 시스템(사용자 결정 필수)
4. **Phase 4, 아동 UI 재설계**
5. **Phase 5, 게임 장면:** V2 4종, legacy 모험 처리
6. **Phase 6, 운영 준비:** CI, 브랜치 보호, Alembic, 인덱스, 보안 헤더
7. **Phase 7, TherapyRun:** 승인된 계획 실행, LangGraph 회기 오케스트레이션

각 Phase 경계마다 발견 사항, 제안, 변경 파일, 위험을 보여 주고 사용자 승인(APPROVE / MODIFY / REJECT)을 받은 뒤에 진행한다.

## 8. 5일 데모 변경 기록 (2026-10-05)

**승인 근거**
- 사용자가 5일 데모 흐름을 승인했다(대화 약 10번·약 5분 뒤 '대구대 건너기' 안내, [DEMO_FLOW_PLAN 원문](https://github.com/Riddlerio/s_project/blob/22eef9b993475537ec55859e1cca17dc15d02e73/docs/handoff/DEMO_FLOW_PLAN_2026-10-05.md)).
- Codex 세션의 승인 로그: "승인 절차 하자라고 하기 전까지 알아서 진행"([CODEX_DEMO_TASK 원문](https://github.com/Riddlerio/s_project/blob/22eef9b993475537ec55859e1cca17dc15d02e73/docs/handoff/CODEX_DEMO_TASK_2026-10-05.md) 7절).
- Codex가 토큰을 다 써서 사용자 요청으로 Claude가 서버·치료사 작업을 이어받았다.

**`backend/app/hoya/**`**
- 대화 턴 200 응답에 `nextActivity: "daegu_crossing" | null` 하나만 추가했다. 기존 필드·경로·상태 코드(200/202/409)는 그대로다.
- `SpeechEvidence` 값과 제공자 라벨은 바꾸지 않았다.
- `TARGET_OBSERVED`는 '목표 낱말이 든 시도' 횟수로만 센다. 정확한 발음으로 취급하지 않는다.
- 시작 문구·전환 규칙·DEMO 유도 대본은 heuristic이다(`HEURISTIC_REGISTER.md` 9절).

**`backend/app/games/`**
- 새 게임 id `daegu_crossing`을 추가했다. 기존 4게임의 동작과 저장된 과거 상태는 그대로다.
- 판정 규칙 `ONSET_FRICATION`은 새 heuristic이다(4절).
- 결과 어휘와 태그는 기존 값(`POOR_AUDIO`, `NO_ACOUSTIC_EVIDENCE`, `DEMO_INPUT`)만 쓴다.

**`backend/app/speech/**`·`pronunciation/**`(interface 동결)**
- 바꾸지 않았다. `AcousticSummary` 필드도 그대로다.

**`backend/app/therapist_planning/**`**
- schema는 바꾸지 않았다. 계획의 게임 목록에 새 게임을 넣지 않았다(데모는 계획이 게임을 구동하지 않는다. Phase 7 미착수).
- 빛의 마법은 활동 제안 선택지에서만 숨겼다. 게임 id·과거 기록·치료사 기록 보기는 유지한다.

**`src/speech/**`(HIGH_RISK_TO_TOUCH, 사용자 요청: '스' 감지 개선·두두 목소리 교체)**
- `SustainTracker`에 선택 인자 `OnsetTolerance`를 추가했다. 기본값 0이면 기존 동작이고, 대구대 건너기만 쓴다.
- `KoreanTts`가 두두 음성 파일(VOLI '하람')을 재생한다. 말의 모든 문장이 파일로 있을 때만 재생하고, 재생에 실패하면 같은 말을 브라우저 음성으로 한다. 입력 차단·종료 유예 규칙은 같다.
- 새 파일 `duduClips.ts`를 추가했다. 음성 파일은 오디오 하나를 다시 쓰고, 로그인·시작 버튼을 누를 때 무음으로 한 번 깨운다(`unlockDuduAudio`, iOS Safari의 자동 재생 제한 대응). 재생 위치의 소리 크기(`speakingLevel`, 미리 계산한 값)로 두두의 입을 연다. `src/tiger`의 `faceState`에 선택 인자 `speech`를 더했고 `<Hoya3D action className>` 인터페이스는 그대로다.
- 캡처→파이프라인→인식기→제출 순서와 `CALIBRATION_MS`는 바꾸지 않았다.
- 테스트: `onsetPipeline.test.ts`(기본값과 봐주기 비교), `koreanTts.test.ts`, `duduClips.test.ts`, `backend/tests/test_dudu_voice_lines.py`.

**main 병합 예외(사용자 결정, 2026-10-05):** 6절의 수동 검증(실제 마이크·아이폰·실제 LLM) 전에 'CI 통과, 실제 마이크 미확인'으로 표시해 main에 병합한다. 수동 검증은 리허설에서 하고, 결과와 수정은 다음 PR로 올린다.

**회귀(6절 명령, 2026-10-05):** 백엔드 pytest 445개 통과, `npm test` 243개(33파일) 통과, typecheck·build(dist 자격 증명 검사 포함) 통과, `smoke_api.py` 3항목 OK(리허설 DB 서버 대상), `git diff --check` 통과, `npm audit` 취약점 0개. 실제 마이크·휴대폰·실제 LLM은 미실행.

## 9. Phase 4 변경 기록 (2026-10-05, 아동 화면 '네 차례'·접근성)

**승인:** 사용자가 Phase 4 ①('네 차례' 신호 통일)·②(접근성·저사양 점검)를 승인했다(2026-10-05). 조건은 "마이크 경로는 건드리지 않고, 차임은 마이크가 열리기 전에만"이다. 자세한 내용은 [Phase 4 기록(원문)](https://github.com/Riddlerio/s_project/blob/22eef9b993475537ec55859e1cca17dc15d02e73/docs/handoff/PHASE4_CHILD_SCREENS_2026-10-05.md)에 있다.

**`hoyaChatController.ts`(HIGH_RISK_TO_TOUCH)**
- 선택 의존성 `beforeListen(open)`을 추가했다. 두두 답이 끝난 뒤 듣기(LISTENING)로 가기 전에 화면이 신호를 내고 `open`을 부른다.
- 그동안 상태는 `RESPONSE_SPEAKING`이라 발화를 받지 않는다.
- 대화를 끝내는 답 뒤에는 부르지 않는다. 신호 중에 끝내기·정리되면 열지 않는다.
- 넘기지 않으면 기존과 같다. 기존 테스트 25개는 그대로 통과했고 4개를 추가했다.

**`src/child/**`(음성 로직, HIGH_RISK_TO_TOUCH)**
- `DaeguCrossing.tsx`: 듣기(`listening`)를 차임이 다 들린 뒤에 켠다.
- `ActivitySession.tsx`:
  - 캡처 시작 때 대기 플래그 `modelPending`의 처음 값을 항상 `true`로 했다(전에는 따라 말하기의 첫 시범 때만 `true`).
  - 차례 효과(전의 시범 효과를 넓힘)가 시범 → 차임 → 열기 순서로 이 플래그를 푼다.
  - 제출이 끝나면 다시 막고, 다음 신호가 연다.
  - 프레임 콜백(캡처 → 파이프라인 → 인식기 → 제출)의 코드와 순서, `CALIBRATION_MS`는 바꾸지 않았다.
- Space 처리기: 입력 칸에서 누른 Space는 띄어쓰기로 둔다. Space·pointer 처리기 자체는 유지했다.
- DEMO 누르고 말하기는 '네 차례!' 뒤에만 받는다.
- 측정 기준이 하나 바뀌었다. 게임 4종의 `onsetLatencyMs`는 듣기가 열린 때부터 잰다([결정 기록](../DECISIONS.md), 2026-10-05).

**`src/tiger/**`(SAFE_WITH_INTERFACE_CONSTRAINTS)**
- 귀 쫑긋(`duduPerk.ts`)을 더했다. GLB는 머리 뼈 크기, 절차형은 귀 크기를 바꾼다.
- `Hoya3D`가 움직임 줄이기 설정이면 `DuduCharacter`에 `animate={false}`를 넘긴다.
- 그대로인 것: `<Hoya3D action className>`, 17개 동작, 대체 화면·`data-hoya-fallback`, `ACTION_TEXT`, 정지 규칙.

**회귀(2026-10-05):** `npm test` 264개(36파일) 통과, typecheck·build(dist 자격 증명 검사 포함) 통과. 헤드리스 Edge 시간 순서 검사에서 듣기 열림 61번 모두 차임이 0.49~0.51초 앞섰다. 듣는 중 차임과 신호 밖 제출은 0건이었다. 실제 마이크·아이폰·스피커는 미실행(리허설 때).

## 10. 치료사 박자 설정 변경 기록 (2026-10-05, Codex 작성·Claude 인수)

**승인:** 사용자가 분담안을 승인했다(2026-10-05). 내용은 아동별 박자 설정 API, 새 모듈·새 표, 기존 표에는 열을 추가하지 않음, 감사 기록 `GAME_SETTINGS_UPDATE`이다. Codex가 작성했으나 세션이 꺼져 커밋하지 못했고, 사용자 결정에 따라 Claude가 그대로 옮겨 커밋했다.

**`backend/app/db.py`·`models.py`(FREEZE_WITH_EXCEPTIONS)**
- 두 파일은 바꾸지 않았다.
- 새 모듈 `backend/app/game_settings/`에 새 표 `child_game_settings`를 더했다(허용 예외 '새 표 추가'). 시작 박자는 76~100이며 CHECK 제약으로 막는다.

**소유권·CSRF(FREEZE_RECOMMENDED)**
- 새 경로 `GET/PUT /api/therapist/children/{child_id}/game-settings`는 `require_therapist`와 `owned_child`를 거친다.
- 값이 바뀔 때만 감사 기록을 남긴다.

**게임 시작·상태**
- 건너기 시작 때 그 아동의 설정을 `runtime_state.rhythm`에 스냅숏으로 남긴다.
- 진행 응답에는 `rhythm`이 있을 때만 넣는다. 지난 회기는 현재 설정으로 채우지 않는다.

**치료사 근거 보기**
- 관찰 응답에 `automaticEvidence`(건너기만), 회기 응답에 `crossingSummary`를 더했다. 기존 필드는 그대로다.
- 판정 상수는 평가 모듈 값을 읽기만 한다. 저장된 자동 결과와 치료사 결정은 바꾸지 않는다.

**회귀(2026-10-05):** typecheck·build 통과, `npm test` 286개(40파일) 통과. 백엔드 결과는 커밋 메시지에 적는다. 실제 기기는 미실행이다.

## 11. 치료사 화면 시각·빈 대화(2026-10-06, Codex)

**승인:** 사용자가 [당시 번호 작업 지시](https://github.com/Riddlerio/s_project/blob/575f8b27deac6dd1c1d72d9a75f793360ccd61a1/docs/CODEX_TASKS.md) 4번의 마무리와 1·2번 PR 작성을 요청했다.

**치료사 화면 시각**
- 서버의 기존 회기·대화 응답은 시간대 없는 UTC 시각 형식을 유지한다. 응답 필드와 `therapist_planning` 계약은 바꾸지 않았다.
- `src/therapist/formatTime.ts`가 시간대 없는 시각을 UTC로 읽고, 기기 시간대와 관계없이 `Asia/Seoul` 시각으로 표시한다. 박자 설정의 '최근 저장'도 같은 함수를 쓴다.
- 박자 설정 API의 `updatedAt`은 기존부터 UTC 시간대(`+00:00`)를 포함한다. 이 형식도 유지하며 화면에서 서울 시각으로 표시한다.
- `backend/app/therapist_insights/service.py`의 회기 메모 날짜는 시작 시각을 서울 시각으로 바꾼 뒤 계산한다.

**빈 대화 기록**
- `backend/app/therapist_insights/conversation.py`는 완료된 턴이 0개이고 `status != "active"`인 대화를 치료사 목록에서만 숨긴다. 진행 중인 0턴 대화는 유지한다.
- DB의 회기·대화·턴 기록은 삭제하거나 변경하지 않는다. 숨긴 개수는 기존 응답에 추가한 `hiddenEmptyN`으로 전달한다.
- 화면은 숨긴 기록이 있을 때만 '대화 없이 끝난 기록 N건은 숨겼습니다.'라고 안내한다. 기존 응답 필드, 소유권·CSRF 규칙과 임상 집계 기준은 유지한다.

## 12. 대구대 건너기 읽기 전용 집계 (2026-10-06, Codex)

**승인:** 사용자가 [당시 번호 작업 지시](https://github.com/Riddlerio/s_project/blob/575f8b27deac6dd1c1d72d9a75f793360ccd61a1/docs/CODEX_TASKS.md) 5번의 집계 API·프런트 타입·숙달 기준 등록을 요청했다.

- 새 경로 `GET /api/therapist/children/{child_id}/crossing-analytics`는 `require_therapist`와 `owned_child`를 거친다. 다른 치료사의 아동은 404다. 기존 경로·응답·인증 규칙은 유지한다.
- 기존 회기·관찰·마지막 치료사 결정을 조회만 한다. 새 표·열·마이그레이션은 없고, 저장된 관찰·결정·게임 설정을 변경하지 않는다.
- `reviewedN`은 REAL·비seed 회기에서 마지막 결정이 확인·교정인 관찰 중 결과가 `success/retry`이고 음질이 `POOR`가 아닌 수다. `confirmedSuccessN`은 그중 교정을 반영한 성공 수다. `confirmedRate`는 둘의 0~1 비율이며 분모가 없으면 `null`이다. 기존 회기 계획 근거 필터를 재사용한다.
- DEMO·SAMPLE은 출처를 표시하고 임상 비율·숙달 계산에서 제외한다. `deferredN`은 기존 회기 요약처럼 원래 자동 결과가 `uncertain/no_speech`인 수다.
- `autoReasons`는 판정 모듈의 상수를 읽어 시작 마찰 없음 → 짧은 마찰 → 뒤 모음 부족 → 기준 충족 순서로 설명한다. 보류·음질 불량·측정 누락을 실패로 분류하거나 저장 판정을 다시 쓰지 않는다. 자동 설명은 임상 판단이 아니다.
- `rhythm`은 회기 시작 당시의 유효한 스냅숏만 쓰며 없거나 잘못된 값이면 `null`이다. 시각은 기존 응답 형식을 유지한다. 목록은 시작 시각·회기 id 순서로 오래된 것부터 보낸다.
- 숙달 표시는 최신 REAL·비seed 건너기 3회기의 확인 비율이 각각 80% 이상인 제품 규칙이다. [HEURISTIC_REGISTER.md](HEURISTIC_REGISTER.md) 9-2절에 등록했으며 치료사 결정이나 목표를 자동으로 바꾸지 않는다.

## 13. 대구대 건너기 판 반복 (2026-10-07, Claude)

**승인:** 사용자가 10/7에 데모 전 개선으로 '게임 반복으로 연습량 늘리기'와 '반복할 때 배경을 아침·점심·저녁처럼 바꾸기'를 골랐다.

- 새 경로 `POST /api/activities/{session_id}/laps`는 `require_student`·소유 확인·`state_guard`·기존 lease 검사를 거친다. 다른 아동의 회기는 404, 판을 아직 다 건너지 않았거나 최대 판(`games/crossing.py` `MAX_LAPS`=3)을 넘거나 끝난 회기면 409다.
- 다음 판은 **같은 회기** 안에서 첫 줄부터 다시 시작한다. 판마다 새 회기를 만들지 않으므로 치료사 화면의 회기 목록과 숙달 계산(최신 실제 3회기)이 판 수만큼 늘지 않는다. 시도 수(`totalAttempts`)와 관찰은 회기에 이어서 쌓인다.
- 새 판은 `build_stages`로 항목 id를 새로 만들어 계획의 `stages`를 바꾼다. 지난 판의 발화·관찰은 이미 저장되어 그대로 남는다.
- 진행 필드에 `lap`(1~3)과 `maxLaps`를 더했다(시작·재개·발화·다음 판 응답). 기존 필드·의미는 그대로다. 회기 상태 검증(`CrossingState`)에 `lap`(1~3, 기본 1)을 더했다.
- 이벤트 `LAP_START`를 더했고, 판 끝의 `SESSION_COMPLETE` 내용에 `lap`을 더했다. 치료사 기록 문구는 'N판째 시작(같은 회기에서 한 판 더)', 'N판 완료'다.
- 치료사 회기 요약(`crossingSummary`)에 `lapN`(끝까지 건넌 판 수)을 더했다. 도중에 멈춘 판의 시도는 시도 수에만 들어간다.
- 아동 화면: 판을 마치면 "한 번 더 건너 볼까?"를 글로 묻고 '한 번 더 건널래!'/'오늘은 그만할래'를 고른다. 이 문장은 두두 녹음이 없어 소리 없이 보인다(브라우저 음성과 섞지 않음). 판마다 하늘과 빛이 아침 → 점심 → 저녁으로 바뀐다(연출이며 저장하지 않음).

## 14. 대구대 건너기 일반화 확인 낱말 (2026-10-07, Codex)

**승인:** 사용자가 CODEX_TASKS 6번으로 새 경로·상태·중립 이벤트·집계 분리를 명시적으로 요청했다. PR #29·#30 병합 뒤 main `a478934`에서 시작했다.

- 새 경로 `POST /api/activities/{session_id}/probes`는 `/laps`와 같은 `require_student`·아동 소유 확인·`state_guard`·lease 검사를 쓴다. 다른 아동은 404, 판 진행 중·중복 시작·끝난 회기·다른 게임은 409다. `roundsComplete=true`인 판 뒤 한 번 시작하고, 확인 시작 뒤 `/laps`는 409다. 회기 완료 API는 확인 시작·마침 여부와 관계없이 기존처럼 쓸 수 있다.
- 시작·재개·발화 응답의 진행 필드에 `probeStarted`, `probeComplete`, `probeIndex`(시작 전 또는 낱말 없음 0, 진행 중 1~3), `probeTotal`(0~3)을 더한다. 확인 중에는 연습 위치 5/2/10과 `roundsComplete`를 보존하고, 공개 `sessionComplete=false`, `modelCue=false`로 다음 확인 카드를 준다. 확인을 마치면 `sessionComplete=true`, 다음 항목·라운드는 `null`이다. 확인 응답 라운드는 제목 '새 낱말 확인'과 그림 안내를 쓰며 번호는 저장된 연습 위치를 유지한다.
- `CrossingState`에 `probeStarted`, `probeComplete`, `probeItems`, `probeIndex`, `probeAttemptsUsed`를 더해 범위와 단계 간 일관성을 검증한다. 이전 회기는 필드가 없어도 기본값으로 읽는다. 낱말 없음은 시작·완료 상태를 한 번 저장하고 바로 건너뛴다.
- `/utterances`의 음향 판단과 발화·분석·관찰 저장은 기존 경로를 쓴다. 확인 발화의 아동 응답에는 `result`·점수·정오 근거가 없다. 공개 이벤트는 `PROBE_START`(`wordN`), `PROBE_RECORDED`(빈 payload), `PROBE_COMPLETE`(빈 payload)뿐이다. 보류·무발화는 최대 2번 듣고 중립적으로 다음 카드로 간다.
- 새 DB 표·열·마이그레이션은 없다. 기존 관찰 `evidence` JSON에 `probe=true`, `elicitationType="GENERALIZATION_PROBE"`, `probeIndex`, `itemSource="UNPRACTICED_BANK"`를 남긴다. 치료사 관찰 응답에 `isProbe`를 더한다. `crossingSummary.probeN`은 기록한 고유 확인 낱말 수, `probeAttemptN`은 확인 발화 수다. 기존 연습 수치·라운드 1~5·경과 지표에서 확인 관찰을 뺀다.
- 건너기 분석의 회기마다 `probe: {reviewedN, confirmedSuccessN, confirmedRate}`를 더한다. REAL·비샘플·마지막 확인/교정·평가 가능·음질 POOR 제외 필터는 연습과 같다. 분모 없음은 `null`이며 DEMO·샘플도 비율에서 뺀다. 확인은 연습 비율·단계별 비율·자동 이유 집계·80% 연속 3회기 숙달 계산에 섞이지 않는다.
- 아동 화면은 최대 3장 그림 카드, 기존 아이 마디·'네 차례'만 쓴다. 두두 시범·음성·브라우저 합성 음성·정오 피드백·칭찬·입 모양 도움말·점프·효과는 없고 매 시도 뒤 자막 '들려줘서 고마워!'만 보인다. 기존 `/play/goodbye`의 연습 낱말·시도 수에서 확인을 뺀다. 확인 낱말 수·선택·최대 시도 수는 휴리스틱 9-3절에 기록한다.

**회귀(2026-10-07):** typecheck·build(배포 파일 자격 증명 검사 포함), 프런트 343개, 백엔드 574개, DEMO API smoke 3항목, diff 검사 통과. npm audit 취약점 0개. 백엔드는 Windows 정책을 변경하지 않고 uv 기본 Python 3.14와 기존 설치 의존성의 PYTHONPATH로 검사했다. 실제 마이크·아이폰·스피커·LLM·임상 타당성 검증은 미실행이다.

**브라우저 확인:** 새 시연 DB와 별도 포트 8003·5175에서 Edge 헤드리스 1280px·390px 각각 연습 10카드 → 그만 → 확인 3카드 → 마무리 → 치료사 상세·분석을 점검하고 스크린샷을 확인했다. 확인 단계의 음성·정오·칭찬은 없고 연습 집계·마무리 낱말에 섞이지 않았다. 가로 넘침·화면/API 오류 0, 기존 favicon 404만 관측했다. 이 검사는 실제 기기·마이크 확인을 대신하지 않는다.
