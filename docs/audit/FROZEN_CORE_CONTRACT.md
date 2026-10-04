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
