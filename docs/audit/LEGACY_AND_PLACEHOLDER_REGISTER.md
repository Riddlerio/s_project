# legacy·중복·시각 placeholder 목록

Phase 0 감사 결과다(`origin/main` 6ee9c54). 여기 적은 항목은 이번 Phase에서 아무것도 삭제하거나 변경하지 않았다.

## 1. legacy와 중복

| # | 항목 | 공존하는 이유 | route·사용 여부 | 위험 | 처리(사용자 결정) |
|---|---|---|---|---|---|
| 1 | `src/child/PlaySession.tsx`(legacy 모험)와 `src/child/ActivitySession.tsx`(V2 5라운드) | MVP 모험 위에 V2를 추가하면서 legacy를 교체하지 않음 | 둘 다 route에 있음(`/play/session/:id`, `/play/activity/:id`). WorldMap의 "기존 모험" 버튼으로 legacy에 들어감. `speech/capabilities.ts`의 `legacy_adventure`로 제어 | 음성 파이프라인과 이벤트 어휘가 두 벌. 공용 음성 모듈을 바꾸면 양쪽이 모두 영향받음 | Phase 5에서 처리 |
| 2 | 백엔드 legacy 흐름(`/api/play/start`·`utterances`, `training/plan_generator.py`, `training/policy.py`)과 V2(`/api/activities`, `games/rounds.py`) | 1과 같음 | 둘 다 사용 중. **의존성:** `seed.py`가 legacy `start`/`play_utterance`/`complete`로 데모 자료를 만듦. 백엔드 테스트 3개 파일(`test_api_flow`, `test_hardening`, `test_review_blockers`)이 `/api/play/start`를 호출함. V2 ActivitySession도 보상을 legacy `/api/play/sessions/{id}/complete`에서 받음. **공용 세션 상태 경계:** `backend/app/session_state.py`가 legacy와 V2의 `runtime_state`를 따로 검증하고(`legacy_state`, `activity_state`, `completion_state`, `state_guard`), `main.py`가 두 흐름에 모두 연결함 | 같은 아동과 목표에 서로 다른 적응 정책이 둘. legacy 단어 경로에는 음질 게이트가 없음 | Phase 5에서 처리. 제거하려면 seed와 테스트를 V2로 다시 만들고, 보상 endpoint를 유지하거나 옮기고, `session_state.py`의 경계를 함께 정리해야 함 |
| 3 | 🧚 루미 `src/character/Character.tsx`와 `src/tiger/Hoya3D.tsx` | 캐릭터를 호야로 바꾸는 중 | PlaySession에서 둘이 동시에 보임 | 캐릭터 정체성 혼란 | Phase 2와 Phase 5 |
| 4 | TTS 구현 3벌: `character/tts.ts`, CharacterHome의 로컬 `speak`, HoyaChat의 `speakKorean` | 화면마다 따로 구현 | 모두 사용 중 | 동작이 제각각 | Phase 4 |
| 5 | legacy `AIRecommendation`(R1–R5), `ActivityRecommendation`, 치료사 회기 계획 | 추천 흐름이 차례로 추가됨 | 셋 다 동작. legacy는 치료사 화면의 "고급 정보"에 있음 | legacy 추천은 미검증·DEMO 자료로 만들어지는데, 수락하면 목표 버전이 바뀜. 그러면 작성 중인 계획 초안의 승인이 막힘(409). "다음 단계" 출처가 셋 | Phase 1(지표 분리·표시), 이후 통합 판단 |
| 6 | `ActivityRecommendation.assignedActivity`와 회기 계획 | 계획 실행(TherapyRun)이 아직 없음 | 아동 지도의 "치료사 배정 활동"이 `collection_json.assignedActivity`에 의존함 | 역할이 겹침. 없애면 Phase 7 전까지 기능 공백 | Phase 7에서 통합 판단 |
| 7 | `/api/children/{id}/progress`와 `SessionTrendChart` | legacy 지표 | 치료사 "고급 정보"에 있음 | AI 추정값과 DEMO가 섞임 | Phase 1 |
| 8 | `GameType`(`monster_tower`, `magic_beam`; `enums.py`, `src/shared/levels.ts`)과 `GameKind`(V2 4종) | legacy 게임 enum | 둘 다 사용. PlaySession에 `monster_tower`를 `monster_adventure`로 바꾸는 대응이 있음 | 혼동 | Phase 5 |
| 9 | 규칙 사본: 음질(`audio_quality.py`, `audioQuality.ts`), 빔(`pipeline.py`, `evaluation.py`), 종료 유예(`rounds.py`, `vad.ts`) | 손으로 옮겨 적음 | 모두 사용 | **음질 규칙은 이미 어긋남** | heuristic을 정리하는 Phase에서 처리 |
| 10 | `TherapistRule`·`TherapistFeedback` | 치료사 교정 기능 | V2 점수 계산과 호야 `allowed_cue`에 영향 | `params.variant`에 transcript가 저장되는데 보존 기간 삭제 대상이 아님 | 유지. 보존 범위는 Phase 6 |

## 2. 미사용 코드(Phase 0.5 정리 PR에서 삭제하기로 승인됨)

| 항목 | 사용처 | 판단 |
|---|---|---|
| `src/character/dialogue.ts`(`ScriptedDialogueProvider`, `lineForEvent`) | 없음 | 삭제. 루미 대사와 legacy `GameEvent` 표현이 Phase 2와 Phase 4에서 혼동을 줌. `lines.ko.ts`는 PlaySession이 쓰므로 유지 |
| `backend/app/security.py`의 `issue_token` | 없음 | 삭제. 쿠키 인증 이후 쓰지 않는 bearer 토큰으로, 다시 쓰이면 CSRF 설계를 우회함. `AuthToken` 모델과 표는 기존 DB 보존을 위해 유지 |
| `backend/app/auth.py`의 `require_child_access` | 없음 | 삭제. 감사 기록 없음, ADMIN 무조건 통과, 테스트 없음. Phase 7에서 필요해지면 새로 설계 |

기록만 하는 항목(삭제는 승인되지 않았다):

- `Therapist.password_hash`와 `password_salt`(`Account`와 중복)
- 루트의 `main.py` stub(16바이트)
- 루트의 agent 프롬프트 파일 4개: `SPEECH_HERO_TASK.md`, `SPEECH_HERO_FINAL_RELIABILITY_DATASET_PRONUNCIATION_PROMPT.md`, `SPEECH_HERO_HOYA_ADAPTIVE_CHAT_FINAL_PROMPT.md`, `THERAPIST_WORKFLOW_PROMPT.md`
- 참조되지 않는 jpg: `20190610.010190759320001i1.jpg`

## 3. 시각 placeholder

| 위치 | 내용 | 종류 |
|---|---|---|
| `src/tiger/Hoya3D.tsx`의 `Tiger` | capsule, sphere, box, torus, cylinder, cone 약 20개와 단색 재질. 줄무늬는 납작한 box, 망토는 삼각 원뿔. sine 움직임만 있음 | 기본 도형 3D, 에셋 없음 |
| `src/tiger/Hoya3D.tsx`의 `HoyaFallback` | 🐯 emoji(120px) | emoji |
| `src/pages/Landing.tsx` | ✨ emoji와 "**루미**와 함께 신나는 마법 모험!" | emoji, 옛 이름 |
| `src/child/RewardScreen.tsx` | ✨ emoji와 "**루미**: 다음에 또 만나!". 보상이 텍스트 나열 | emoji, 옛 이름 |
| `src/character/Character.tsx`, `lines.ko.ts` | 🧚 요정과 "나는 루미야" 등 | emoji, 옛 이름 |
| `src/child/WorldMap.tsx` | "★ N층" 알약 10개짜리 2열 grid. 카드와 배지는 쉼표로 이은 텍스트 | 가짜 지도 |
| `src/child/PlaySession.tsx` | 몬스터 ✨/⚡🐲/🛡️🐲/🐲, 체력 ❤️ 반복 | emoji |
| `src/child/ActivitySession.tsx` | 라운드 표시 ⭐🔵○. 게임 4종이 한 화면을 공용으로 씀. conversation_quest R1에 "바나나 고르기" 버튼이 하드코딩됨 | emoji, 전용 장면 없음 |
| `src/game/magicBeam/BeamCanvas.tsx` | 600×150 canvas에 남색 배경, ✨ 텍스트, 점선, gradient 막대 | 임시 canvas 그래픽 |
| `src/child/CharacterHome.tsx` | CHEER→IDLE 타이머 고정. "모험 지도"와 "게임하기" 버튼이 같은 경로로 감 | 하드코딩된 상태, 중복 버튼 |
| `src/styles/child.css` | 단색 gradient 배경, emoji 몬스터 float 애니메이션 | 기본 스타일 |
| `PlayItem`·`ActivityItem`의 `pictureKey` | 읽는 곳이 없음. 항목 이미지를 보여 주지 않음 | 빠진 이미지 |
| 에셋 전체 | `public/` 없음. 이미지, 오디오, 3D, 폰트, favicon이 없음 | 에셋 없음 |

**의도된 정직 표시(placeholder 아님):** DEMO 고지 문구가 해당한다.

- WorldMap "DEMO 연습"
- PlaySession "DEMO · Space를 누르며 발성"
- ActivitySession "DEMO 입력입니다. 실제 발음 평가가 아닙니다."
- HoyaChat "DEMO로 대화 시작"
- PlayEntry "DEMO 서버입니다"

일부 문구는 테스트가 확인한다. 디자인을 바꾸더라도 고지는 유지한다.

**시각 문제가 아니라 데이터 문제인 항목:** ActivitySession의 키보드 DEMO가 r4 라운드에서 `sustainSegmentsMs`를 만들어 낸다. 이 항목은 Phase 1에서 확인한다.

**에셋 IP:** 루트의 jpg는 대구대학교 백호 마스코트이고 대학 로고가 들어 있다. 호야 디자인에 참고할지, 사용 권한이 있는지는 Phase 3에서 사용자가 결정한다.
