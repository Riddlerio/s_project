# 제품 현실 매트릭스 (Phase 0 감사)

- 기준 시점: `origin/main` 6ee9c54 (PR #7 치료사 회기 계획, PR #6 발음 연구 머지 후), 2026-09-30
- 방법: 저장소 코드와 설정을 읽기 전용으로 감사했다. 파일 이름만 보고 기능이 있다고 판단하지 않았다.
- 원칙:
  - 코드가 있다고 제품이 완성된 것은 아니다.
  - heuristic은 검증된 모델이 아니다.
  - DEMO 경로는 임상 경로가 아니다.
  - 정적 렌더링은 UX 검증이 아니다.
  - 마일스톤 수락은 제품 소유자(사용자)가 결정한다.

상태 값: IMPLEMENTED, FUNCTIONAL_PROTOTYPE, HEURISTIC_BASELINE, DEMO_ONLY, PLACEHOLDER, PARTIALLY_IMPLEMENTED, NOT_IMPLEMENTED.
보조 표시: UNVALIDATED, VISUAL_PLACEHOLDER, LEGACY, FUTURE, EXTERNAL_DEPENDENCY, SECURITY_SENSITIVE, CLINICAL_SENSITIVE.

## 1. 핵심 사실

1. **임상 무결성 결함.** `backend/app/main.py`의 `start()`(390행)와 `start_activity()`(554행)는 `TrainingSession`을 만들 때 `is_seed`를 넘기지 않는다. 기본값이 False다.
   - 그래서 seed 아동이 "실제 음성" 모드로 플레이한 회기는 `clinical_eligible()`을 통과한다.
   - 이 회기의 관찰은 임상 근거, 회기 계획, 활동 제안에 들어갈 수 있다. 이 경우를 다루는 테스트는 없다.
   - **Phase 1에서 수정(2026-10-04):** 두 경로와 호야 대화 모두 `is_seed=child.is_seed`로 저장하고 `test_clinical_integrity.py`가 확인한다. 수정 전에 잘못 저장된 과거 행은 읽기 전용 `backend/scripts/audit_seed_provenance.py`로 세기만 하며, 수리 여부는 사용자가 정한다.
2. **"AI" 이름이 붙은 기능 가운데 학습된 ML 모델은 없다.** 외부 LLM은 호야 대화와 치료사 요약 두 곳뿐이고, 둘 다 기본값이 꺼짐이다.
3. **heuristic 수치 중 연구 근거가 확인된 값은 없다.** 자세한 내용은 `HEURISTIC_REGISTER.md`에 있다.
4. **시각 요소는 대부분 placeholder다.**
   - 호야 3D는 기본 도형을 조립한 것이다. 3D 에셋, rig, 애니메이션 클립이 없다.
   - emoji를 시각 요소로 쓰는 곳이 많다.
   - 예전 캐릭터 이름 "루미"가 남아 있다.
   - 지도는 알약 모양 목록이다.
   - V2 게임 3종에는 전용 장면이 없다.
5. **legacy와 V2가 둘 다 route에 연결되어 동작한다.** 대상은 게임 파이프라인, 추천, 지표다.
6. **승인된 회기 계획을 읽는 코드가 없다.** 계획은 기록만 되고 회기를 구동하지 않는다(설계상 다음 Phase).
7. **보안 핵심은 구현되어 있다.** PBKDF2, 해시로 저장하는 쿠키 세션, CSRF, `owned_child`가 있고 원음성은 저장하지 않는다.
   - 프록시 IP, `child_code`, transcript 파생 데이터 보존, HSTS 쪽에 빈틈이 있다.
8. **운영 준비가 부족하다.** CI가 없고, main 브랜치 보호도 없다(GitHub API 404 "Branch not protected"). Alembic도 없다.

## 2. 매트릭스

| 영역 | 상태 | 근거(파일 · 요소) | 실제로 하는 것 | 하지 않는 것 / 한계 | 위험 |
|---|---|---|---|---|---|
| A. 제품 UI 전반 | PLACEHOLDER · VISUAL_PLACEHOLDER | `src/styles/{global,child,therapist}.css`(합계 10줄), `src/pages/Landing.tsx` | 한 가지 보라 버튼 스타일, 760px 중앙 열, 단색 gradient | 디자인 토큰, 폰트, 반응형 기준점, 레이아웃 셸이 없음. Landing은 ✨ emoji와 "루미" 문구 | 중간 |
| B. 호야 3D | PLACEHOLDER · VISUAL_PLACEHOLDER | `src/tiger/Hoya3D.tsx`의 `Tiger` | R3F Canvas, 기본 도형 메시 약 20개, `useFrame` sine 움직임, WebGL fallback(🐯) | GLB/GLTF/FBX 에셋, rig, skeleton, 애니메이션 클립, 승인된 캐릭터 모델이 없음 | 중간 |
| C. 아동 경험 | FUNCTIONAL_PROTOTYPE · VISUAL_PLACEHOLDER | `src/child/*` route 8개(`src/App.tsx`) | 로그인, 홈, 지도, 5라운드 활동, 호야 대화, 보상(legacy 모험은 2026-10-04 삭제) | `WorldMap`은 "★ N층" 알약 10개짜리 grid이고 실제 지도가 아님. 보상은 텍스트 나열. CharacterHome의 메뉴 버튼 두 개가 같은 경로로 감 | 중간 |
| D. 게임 | FUNCTIONAL_PROTOTYPE · VISUAL_PLACEHOLDER | `src/game/magicBeam/MagicBeamScene.tsx`, `src/child/ActivitySession.tsx` | 빛의 마법 3D 장면, V2 4종을 한 화면이 공용으로 처리(legacy 상태 기계와 canvas 막대는 2026-10-04 삭제) | sky_climb, monster_adventure, conversation_quest 전용 장면이 없음. `pictureKey`를 쓰는 곳이 없음 | 중간 |
| E. 치료사 UI | FUNCTIONAL_PROTOTYPE | `src/therapist/**` | 담당 아동 목록, 4탭 작업 공간, 회기 계획 편집기, 세션 상세, recharts 그래프 | 기본 수준 스타일. 일부 legacy 지표가 섞여 있음(9절) | 낮음 |
| F. 음성 입력 | FUNCTIONAL_PROTOTYPE · UNVALIDATED · EXTERNAL_DEPENDENCY | `src/speech/{audioCapture,vad,micUtterance,features,sustainTracker,fricativeDetector,webSpeechRecognizer}.ts` | AudioContext 분석(FFT, RMS, HF 비율), VAD, 브라우저 Web Speech ko-KR 인식 | 아동 음성으로 보정한 적 없음. Web Speech는 브라우저 제공자 서버로 음성을 보냄 | 높음 |
| G. 발음 분석 | HEURISTIC_BASELINE · UNVALIDATED · CLINICAL_SENSITIVE | `backend/app/speech/pipeline.py`의 `analyze`, `g2p.py`의 `SimpleKoreanG2P`, `alignment.py`의 `align` | ASR 문장을 규칙 G2P로 음소화한 뒤 편집거리로 정렬해 가중 점수를 냄. 기준은 85/75/70 | 오디오를 직접 보지 않음. 음향 모델, 신뢰도 모델이 없음. G2P 규칙이 일부만 있음(비음화·구개음화 없음) | 높음 |
| H. 음향 분석 | HEURISTIC_BASELINE · UNVALIDATED | `backend/app/pronunciation/{acoustic,audio_quality}.py`, `src/speech/audioQuality.ts` | 클라이언트가 보낸 음향 요약을 검증하고 GOOD/FAIR/POOR/UNKNOWN 음질을 판정 | 분류기 없음. Python과 TS 음질 규칙이 이미 어긋나 있음 | 중간 |
| I. 호야 대화 | FUNCTIONAL_PROTOTYPE · UNVALIDATED · CLINICAL_SENSITIVE | `backend/app/hoya/**`, `src/child/hoyaChatController.ts` | 결정적 전략 정책, 중복 방지 turn, 금지 표현 검사, OpenAI(선택)와 DEMO fallback | 실제 OpenAI는 mock으로만 검증함. 아동 화면에 제공자(DEMO/OPENAI)가 표시되지 않음 | 중간 |
| I-1. 호야 DemoProvider | DEMO_ONLY | `hoya/providers/demo_provider.py` | 키워드와 `TOPICS` 표로 정해진 질문을 고름 | 언어를 이해하지 않음. 운영 fallback으로도 쓰임 | 낮음 |
| I-2. 호야 OpenAI 제공자 | IMPLEMENTED · UNVALIDATED · EXTERNAL_DEPENDENCY · SECURITY_SENSITIVE | `hoya/providers/openai_provider.py` | `responses.parse`, `store=False`, 재시도 없음, 도구 없음 | 실제 API smoke 테스트가 없음 | 중간 |
| J. 치료사 요약 AI | IMPLEMENTED · UNVALIDATED · EXTERNAL_DEPENDENCY · CLINICAL_SENSITIVE | `therapist_planning/summary.py`의 `llm_summary`, `validate_summary`, `finalize` | 기본값 꺼짐(템플릿 요약). 켜면 동기 OpenAI 호출, 금지어·숫자·비율 검증, 제안 문장은 서버 문장으로 교체 | 실제 LLM 호출 검증 없음. 요청 안에서 동기로 호출됨(timeout 10초) | 중간 |
| K. 치료사 회기 계획 | FUNCTIONAL_PROTOTYPE · CLINICAL_SENSITIVE | `backend/app/therapist_planning/**`, `src/therapist/workspace/**` | 6단계 LangGraph, 검증된 REAL 근거만 사용, DRAFT→APPROVED→SUPERSEDED/CANCELLED, clone, 스냅숏, 감사 기록 | 승인된 계획을 읽는 코드가 없음(Phase 7). 제안 규칙은 heuristic | 중간 |
| L. 임상 근거 흐름 | PARTIALLY_IMPLEMENTED · CLINICAL_SENSITIVE | `clinical/observation_builder.py`, `main.py`의 `decide_observation`, `clinical_summary` | 발화마다 관찰을 만들고, 치료사 검증을 append-only로 쌓으며 DEMO_* 상태를 분리함 | `is_seed` 누락(1절). legacy 경로가 미검증·DEMO 자료를 치료사 숫자에 섞음(9절). 음향값은 CLIENT_REPORTED이며 검증하지 않음 | **높음** |
| L-1. 활동 제안 | HEURISTIC_BASELINE · UNVALIDATED · CLINICAL_SENSITIVE | `clinical/activity_recommendation.py`의 `propose_activity` | 검증된 REAL 관찰 최근 10건에 규칙 적용. 수락하면 `collection_json.assignedActivity`에 기록 | 기준값 근거 없음 | 중간 |
| L-2. legacy AI 추천(R1–R5) | HEURISTIC_BASELINE · LEGACY · UNVALIDATED · CLINICAL_SENSITIVE | `analysis/recommendation.py`의 `recommend`, `main.py`의 `/api/recommendations/{id}/decision` | 미검증 AI 점수와 ProgressMetric에 if 규칙을 적용. 수락하면 목표 버전을 새로 만듦 | DEMO와 seed를 걸러내지 않음. "confidence"는 이전 세션 수일 뿐 | **높음** |
| L-3. insights | HEURISTIC_BASELINE · LEGACY | `analysis/insights.py`의 `generate_insights` | 건수와 태그로 템플릿 문장을 만들고 면책 문구를 붙임 | 추론하지 않음. DEMO를 섞음 | 낮음 |
| M. 보안·개인정보 | PARTIALLY_IMPLEMENTED · SECURITY_SENSITIVE | `main.py`의 `limit_body`와 `security_headers`, `maintenance.py`, `shared/frontend_csp.json` | Origin 검사, 64KiB 본문 제한, CSP/XFO/nosniff/Referrer-Policy, transcript 90일 삭제, 원음성 미저장 | HSTS, Permissions-Policy 없음. `TherapistRule.params.variant`와 `SpeechAnalysis.observed_phones` 같은 transcript 파생 데이터는 삭제되지 않음 | 중간 |
| N. 인증·권한·CSRF | IMPLEMENTED · SECURITY_SENSITIVE | `auth.py`의 `current_account`, `require_*`, `owned_child`, `security.py`의 `hash_password`, `main.py`의 `login` | PBKDF2-SHA256 20만 회, 쿠키 세션 12시간, CSRF 해시 비교, 로그인 throttle, 소유권 404와 감사 기록 | 프록시 뒤에서 IP 버킷이 하나로 합쳐짐. 세션 회전, 만료 행 정리, 비밀번호 재설정 없음. `add_child`가 전체 기관 아동 수로 `child_code`를 만듦. `secret_key`는 쓰이지 않음 | 중간 |
| O. 데이터베이스 | FUNCTIONAL_PROTOTYPE | `db.py`, `models.py`(표 22개) | SQLAlchemy와 SQLite | `relationship()` 없음, FK 누락 다수, 인덱스 부족, N+1 쿼리(`child_detail`, `session_detail`, `overview`) | 중간 |
| O-1. 마이그레이션 | PARTIALLY_IMPLEMENTED | `main.py`의 `lifespan`(`create_all`), `hoya/schema_compat.py` | 새 표 생성, SQLite 전용 호야 표 보정 하나 | Alembic 없음. 기존 표에 열을 추가할 방법이 없음. PostgreSQL은 테스트한 적 없음 | 중간 |
| P. DEMO/seed | DEMO_ONLY · SECURITY_SENSITIVE | `seed.py`, `demo.py`, `/api/auth/demo-login`, `src/child/WorldMap.tsx` | 샘플 계정(seed) 생성과 demo-login만 `SEED_DEMO_DATA`일 때 동작하고, 비밀번호 "speechhero"가 코드에 고정됨. **DEMO 플레이 모드(스크립트 인식·키보드 입력)는 설정과 관계없이 일반 아동 계정에서도 항상 쓸 수 있고, WorldMap의 기본 선택이 DEMO** | 5절의 혼입 지점 참고 | 중간 |
| Q. 테스트 | IMPLEMENTED(logic/API 한정) | `backend/tests/*`(289개), `src/**/*.test.*`(89개) | API 통합, logic, 정적 렌더 | 브라우저 E2E, DOM 상호작용, 실제 마이크, 실제 OpenAI, Web Speech, PostgreSQL, 임상 검증 테스트가 없음 | 높음 |
| R. 배포·운영 | PARTIALLY_IMPLEMENTED | README "Production 실행", `backend/.env.example` | uvicorn 단일 프로세스 절차, 안전한 기본값(`cookie_secure=True`, seed 꺼짐) | CI 없음, 브랜치 보호 없음, Dockerfile 없음, 백업 없음, 요청 로깅 없음, LLM smoke 없음 | 높음 |
| S. 문서 | PARTIALLY_IMPLEMENTED | `README.md`, `docs/therapist-workflow.md`, `docs/references/**` | 계약 문서와 README의 최근 절(회기 계획, 호야 대화)은 최신. README 구조 설명에는 낡은 부분이 있음(존재하지 않는 `TrainingPolicy` 클래스를 설명하지만 실제는 `training/policy.py`의 `decide` 함수) | `docs/ARCHITECTURE.md`가 낡음(호야 대화, 쿠키 인증, 5라운드, 회기 계획이 빠짐). 루트에 agent 프롬프트 파일 4개와 참조되지 않는 jpg가 있음 | 낮음 |
| T. 에셋 | NOT_IMPLEMENTED | `git ls-files`에 이미지·오디오·3D·폰트 없음 | 루트의 `20190610.010190759320001i1.jpg` 1장(대구대 백호 마스코트, 대학 로고 포함)만 있고 코드에서 참조하지 않음 | 제품 에셋 없음. CSP가 `'self'`만 허용하므로 에셋은 자체 호스팅해야 함. 마스코트 IP 확인 필요 | 중간 |
| U. 외부 서비스 | EXTERNAL_DEPENDENCY | Web Speech API, OpenAI(두 곳), LangGraph(로컬 실행) | 선택 기능과 브라우저 의존 기능 | LangSmith 미설정(모니터링 전용 원칙). 분석 도구, CDN 없음 | 중간 |
| V. 기술 부채 | LEGACY | `enums.py`의 `GameType.monster_tower`, `src/api/therapist.ts`의 `api<any>`, 죽은 코드(`LEGACY_AND_PLACEHOLDER_REGISTER.md`) | — | — | 낮음 |

## 3. "AI" 명칭과 실제 구현

분류 기호: A 학습 모델, B 외부 LLM/API, C 결정적 규칙, D heuristic 기준값, E ASR 기반 근사, F DEMO 스크립트.

| 이름 | 위치 | 실제 | 불일치 |
|---|---|---|---|
| `SpeechAnalysis.ai_score` / `ai_result`, `analyze()` | `speech/pipeline.py` | E(단어), D(빔) | "AI"라고 부르지만 규칙과 정렬 방식임. `method="asr_text_alignment_v1"` 라벨은 정확함 |
| `AIRecommendation`, `confidence` | `analysis/recommendation.py` | C/D | "AI"와 "confidence" 모두 부정확. confidence는 이전 세션 수 |
| `generate_insights` | `analysis/insights.py` | C(템플릿) | "insight"라는 이름. 면책 문구 자체는 정직함 |
| `ClinicalObservation.ai_result` / `ai_confidence`, provenance `AI_ESTIMATED` | `clinical/observation_builder.py` | D | "AI_ESTIMATED"라는 표현 |
| `propose_activity`의 `confidence` | `clinical/activity_recommendation.py` | D | 검증 관찰 5건 이상이면 MEDIUM |
| `quest_reply` | `games/conversation.py` | F | 라벨 `DEMO_RULES`는 정확함 |
| ~~`DemoRecognizer`~~ | ~~`src/speech/demoRecognizer.ts`~~ | — | 2026-10-04 legacy 모험과 함께 삭제 |
| 호야 대화 제공자 | `hoya/providers/*` | B(선택) / F | 정확함 |
| 치료사 요약 | `therapist_planning/summary.py` | B(선택) / C 템플릿 | 정확함 |

결정: 명칭 정리와 heuristic 수정은 나중 Phase에서 한다. 지금은 기록만 한다.

## 4. DEMO와 REAL 경로

**REAL 경로**
1. 쿠키 로그인
2. 모드 `real`
3. 마이크와 Web Speech 입력(`source=microphone`)
4. 음질 게이트
5. ClinicalObservation 생성(PENDING)
6. 치료사가 confirm/correct하면 CONFIRMED/CORRECTED
7. 최근 실제 회기 5개로 회기 계획과 활동 제안
8. 템플릿 요약 또는 LLM 요약
9. 승인된 계획(아직 이를 읽는 곳 없음)

**DEMO 경로**
1. `SEED_DEMO_DATA=true`이면 `seed()`가 치료사 demo와 HERO01–03을 만든다.
2. seed 회기 7개를 legacy `start`/`play_utterance`/`complete`로 생성한다. 고정 transcript와 합성 음향값을 쓴다.
   - 이와 별도로, DEMO 플레이 모드(`mode=demo`, `DemoRecognizer`, 키보드 입력)는 `SEED_DEMO_DATA`와 관계없이 모든 아동 계정에서 쓸 수 있다. WorldMap은 DEMO를 기본으로 선택한다.
3. 이 과정에서 관찰과 legacy 추천이 만들어지고, R1/R2는 자동 수락되어 목표 버전이 바뀐다.
4. `/api/auth/demo-login`을 쓸 수 있다.
5. `DemoRecognizer`와 Space 키 입력은 `source=keyboard`로 기록된다.
6. 호야 대화는 DemoProvider를 쓴다.
7. 치료사 검토는 `DEMO_*` 상태로 기록된다.

**DEMO가 REAL로 오인될 수 있는 지점** (아래 네 항목은 Phase 1에서 수정했다. 계산은 바꾸지 않고 출처를 분리·표시한다)
1. `is_seed` 누락: seed 아동의 실제 모드 회기가 임상 근거로 들어간다. → 수정.
2. `/progress` 추이 그래프(`SessionTrendChart`)가 모드와 seed를 구분하지 않는다. 고급 정보 안에 경고 문구만 있다. → x축에 실제·DEMO·샘플을 표시.
3. legacy 추천이 DEMO 자료로 만들어지고, 대시보드의 "대기 중인 추천 N건"에 섞인다. → 실제 아동의 DEMO 연습에서는 만들지 않고, 과거 행은 대기 수에서 빼며 거절만 할 수 있다. 비교 회기도 같은 출처만 쓴다.
4. Overview 최근 세션에 seed 표시가 없다. → 실제·DEMO·샘플 표시.
5. SessionDetail은 seed가 아닌 모든 세션을 "실제 진행"으로 표시한다. 모드는 따로 표시된다.
6. 목표 이력의 `source=recommendation`이 seed 자동 수락으로 생긴 것일 수 있다.
7. 호야 대화가 "실제" 모드여도 DemoProvider로 동작할 수 있는데, 아동 화면에 표시가 없다.
8. 키보드 DEMO가 r4 라운드용 음향 구간(`sustainSegmentsMs`)을 만들어 낸다(`src/child/ActivitySession.tsx`).

## 5. 테스트와 회귀 지도

| 영역 | 기존 테스트 | 실제로 검증하는 것 | 검증하지 않는 것 | 회귀 위험 |
|---|---|---|---|---|
| 인증·CSRF·IDOR | `test_api_flow.py`, `test_hardening.py`, `test_therapist_planning.py` | 쿠키, 역할, CSRF, 소유권 404, throttle | 프록시 환경, 세션 회전 | 낮음 |
| 보안 헤더·CSP·dist | `test_review_blockers.py`, `src/build/csp.test.ts`, `scripts/check-dist.mjs` | 헤더, meta CSP, dist 안의 비밀 문자열 | 실제 브라우저 CSP 위반 | 낮음 |
| 5라운드 엔진 | `test_round_engine.py`, `test_hardening.py`, `test_sustain_v2.py` | 라운드 규칙, 이어하기, 재개 | 실제 아동 음성 | 중간 |
| 임상 무결성 | `test_clinical_integrity.py`, `test_therapist_planning.py`, `src/therapist/clinicalLabels.test.ts` | 분모 제외, DEMO 분리, 검증 자료만 사용, seed 출처·legacy 추천 출처(Phase 1) | 과거에 잘못 저장된 행의 수리 여부 미결정 | **높음** |
| 호야 대화 | `test_hoya_chat.py`, `test_hoya_chat_reliability.py`, `src/child/hoyaChat*.test.ts`, `src/api/hoyaChat.test.ts` | 중복 방지, 복구, 금지 표현, mock OpenAI | 실제 OpenAI, 실제 음성 대화 | 중간 |
| 음성 DSP | `src/speech/*.test.ts`, `src/game/game.test.ts` | 합성 frame으로 VAD, 음질, 지속 | 실제 마이크, 기기 편차 | 높음 |
| 호야 3D | `src/tiger/Hoya3D.test.tsx` | WebGL 확인 로직, fallback 문구 정적 렌더 | WebGL 화면, 시각 품질 | 중간 |
| 치료사 작업 공간 | `src/therapist/workspace/workspace.test.tsx` | 정적 렌더와 순수 함수 | 상호작용, 브라우저 | 중간 |
| 아동 화면 | 없음 | — | Landing, WorldMap, CharacterHome, Play, Activity, Reward 전부 | 높음 |
| 연구 경계 | `test_research_guard.py` | ML 의존성과 연구 코드 import 금지 | — | 낮음 |
| 수동 smoke | `backend/scripts/smoke_api.py` | 실제 서버를 띄워 로그인, 5라운드, 회기 계획, 호야 DEMO 흐름 | 브라우저 | 낮음 |

존재하지 않는 테스트 유형은 다음과 같다. 정적 렌더를 시각 품질 검증으로 취급하지 않는다.

- 브라우저 E2E
- DOM 상호작용
- 시각 회귀
- 실제 마이크
- 실제 Web Speech
- 실제 OpenAI
- PostgreSQL
- 부하
- 아동 음성 임상 검증

## 6. 운영 준비 점검(읽기 전용)

| 항목 | 현재 |
|---|---|
| DB | SQLite 기본값, `create_all`, Alembic 없음, PostgreSQL 미검증(`current_account`의 tzinfo 제거처럼 SQLite에 맞춘 처리가 있음) |
| 환경 설정 | `config.py` 기본값은 안전함. `secret_key`는 쓰이지 않음 |
| CI / 브랜치 보호 | 없음(`.github` 없음, protection API 404) |
| 배포 | README의 단일 프로세스 절차. TLS는 역방향 프록시에 맡김. 프록시 헤더 처리 없음 |
| E2E / LLM smoke | 없음 |
| 에셋 파이프라인 | 없음(`public/` 없음) |
| 로깅 | 모듈 logger 몇 개. 요청 로깅과 오류 수집 없음 |

## 7. 사용자 결정 기록 (Phase 0)

| 질문 | 결정 |
|---|---|
| Frozen Core / Mutable Zone 제안 | 둘 다 승인 |
| legacy 경로 | 필요 없는 것은 없애는 방향. 미사용 코드 3개는 재판단 뒤 삭제를 승인했고 별도 정리 PR에서 실행한다. 나머지 legacy는 Phase를 진행하며 처리한다 |
| "AI" 명칭 불일치와 근거 없는 heuristic | 둘 다 나중 Phase에서 수정한다 |
| Phase 순서 | 제안 순서 승인(`FROZEN_CORE_CONTRACT.md` 7절) |

## 8. 2026-10-05 갱신 (5일 데모, `claude/dudu-followup`)

위 1~7절은 2026-09-30 감사 기록이다. 그 뒤 바뀐 것만 여기에 적는다(감사 당시 내용은 고치지 않는다).

| 영역 | 상태 | 근거(파일) | 실제로 하는 것 | 하지 않는 것 / 한계 |
|---|---|---|---|---|
| 두두 3D | FUNCTIONAL_PROTOTYPE | `public/assets/dudu/dudu.glb`, `src/tiger/DuduCharacter.tsx` | Meshy로 만든 GLB(리깅·동작 포함)를 불러오고, 실패하면 절차형 모델로 돌아간다. 공식 흉장을 투영했다 | 대학 디자인 최종 검수 |
| 대구대 건너기 | FUNCTIONAL_PROTOTYPE · HEURISTIC_BASELINE · UNVALIDATED · CLINICAL_SENSITIVE | `src/child/DaeguCrossing.tsx`, `src/game/crossing/**`, `backend/app/games/crossing.py`, `games/evaluation.py` | 3D 횡단보도와 정문, 5라운드 × 2줄. 시작 마찰·유성 구간으로 /ㅅ/를 근사 판정하고, 관찰을 치료사 타임라인에 남긴다 | 성인 1명·PC 마이크 실측값이다. 아동 음성·여러 기기 검증이 없다. 혀 위치 오류(치간음 등)·ㅅ/ㅆ은 구분하지 못해 치료사가 확인한다 |
| 대화 → 게임 전환 | HEURISTIC_BASELINE | `backend/app/hoya/transitions.py`, `src/child/HoyaChat.tsx` | 목표 낱말 시도 10회와 2분, 또는 5분 뒤 두두가 게임을 권한다 | 시도 횟수는 정확한 발음 횟수가 아니다 |
| 두두 목소리 | DEMO_ONLY · EXTERNAL_DEPENDENCY | `public/assets/voice/dudu/*.wav`, `shared/dudu_voice_lines.json`, `src/speech/duduClips.ts` | VOLI '하람' 음성 파일 85개를 재생하고, 없는 말은 브라우저 음성으로 말한다 | 무료 플랜이라 비상업적 사용만 가능하고 출처 표기가 필요하다. 외부 LLM 대화 문장은 파일이 없다 |
| 시연 계정·리허설 | DEMO_ONLY | `backend/app/demo_seed.py`, `backend/scripts/demo_rehearsal.py` | 전용 로컬 SQLite에만 시연 아동·치료사를 만들고, 오늘 기록만 지운다(실제 DB 거부) | 운영 배포용이 아니다 |
| 운영 준비 | 변화 없음 | — | — | CI·브랜치 보호·Alembic은 여전히 없다(Phase 6 미착수) |

**'AI' 명칭(3절) 후속, 2026-10-05:** 치료사 화면 표기만 정리했다. 규칙·기준값 결과(E·D)는 '자동 추정', confidence는 '근거 양'(근거 수 기준임을 함께 적음)으로 보이고, 관찰 카드마다 활동별 판정 방식을 보인다. 외부 LLM(B)인 치료사 요약은 'AI 문장 정리'로 둔다. 내부 이름(`ai_score`, `AIRecommendation`, `AI_ESTIMATED`)은 표·API 동결 때문에 그대로다.

**Phase 1 과거 행(1절 1번) 후속, 2026-10-05:** 수리 도구 `backend/scripts/repair_seed_provenance.py`를 더했다(기본 미리 보기, `--apply` 시 SQLite 백업 후 seed 아동의 게임·대화 회기를 샘플로, 그 관찰의 검토 상태를 DEMO_ 상태로 맞춤, 감사 기록 남김, 예전 스키마의 없는 표는 건너뜀). 로컬 DB 점검 결과는 로드맵 2절에 적었다.
