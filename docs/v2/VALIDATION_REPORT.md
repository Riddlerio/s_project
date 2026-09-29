# Speech Hero V2 검증 기록

기준 브랜치: `feature/speech-hero-v2-hardening` (PR #2 merge 이후) · 2026-09-28. 아래 "호야와 대화하기" 절은 `feature/hoya-adaptive-chat` · 2026-09-29 기준이다.

## 호야와 대화하기 (feature/hoya-adaptive-chat)

| 명령 | 실행 결과 |
|---|---|
| 작업 전 main(`09377fc`) baseline | pytest 184개 통과, Vitest 47개 통과(10개 파일), typecheck·build·`git diff --check`·audit 통과 |
| `backend\.venv\Scripts\python.exe -m pytest backend -q --basetemp backend/test-temp -p no:cacheprovider` | 228개 통과 (새 `test_hoya_chat.py` 44개), 경고 1개 |
| `npm.cmd run typecheck` | 통과 |
| `npm.cmd test` | 62개 통과 (11개 파일) |
| `npm.cmd run build` | 통과. dist 13개 파일에서 샘플 계정·`OPENAI_API_KEY`·`HOYA_CHAT_`·`VITE_OPENAI`와 `.env` 파일 없음 |
| `git diff --check` / `npm.cmd audit` | 공백 오류 없음 / 취약점 0건 |
| `smoke_api.py` (임시 DB·DEMO 서버) | 기존 흐름과 호야 대화 DEMO 흐름(시작 → 3 turn → 중복 turn 409 → 종료) 통과 |
| 브라우저(Playwright, Vite 개발 서버 + DEMO 백엔드) | DEMO 대화 시작 → 인사 → LISTENING → 입력 → 답변 → 자동 LISTENING, 대화 끝내기 확인. 응답을 2.5초 늦췄을 때 약 0.1초에 THINKING, 0.75초에 "음..." 1회, 응답은 "음..." 재생이 끝난 뒤 시작(겹침 없음) |

- 자동 테스트 범위: DEMO·가짜 OpenAI(공식 SDK + mock transport) 정상, 시간 초과·5xx·JSON 아님·schema 불일치·빈 응답 → DEMO 대체, 외부 소켓 연결 차단. 대화 정책 6가지, BANK 재사용·제외 단어·다른 음소 차단, 프롬프트 주입(지시문 노출·전략 변경 거부, 도구 없음), 401·CSRF·Origin·다른 아동 404·보호자 동의·잘못된 본문 4xx, 보존 기간 비우기·음성 자료 삭제 FK·임상 통계 불변, `backend/.env` 위치·OS 환경 변수 우선. 프런트엔드는 THINKING·"음..." Case 1~10(대체 화면 포함)과 기존 게임 매핑 불변을 테스트했다.
- **실제 OpenAI 호출: NOT MANUALLY VERIFIED** (`backend/.env`의 key·model이 비어 있음). 실물 마이크로 하는 자동 turn(호야 TTS를 다시 듣지 않는지)과 Android 브라우저도 NOT MANUALLY VERIFIED.
- 대화 근거는 임상 통계에 넣지 않는다. **NOT VALIDATED — NO LABELED DATA.**

## 자동 검증

| 명령 | 실행 결과 |
|---|---|
| `backend\.venv\Scripts\python.exe -m pytest backend -q --basetemp backend/test-temp -p no:cacheprovider` | 184개 통과, 경고 2개 |
| `npm.cmd run typecheck` | 통과 |
| `npm.cmd test` | 44개 통과 (10개 파일) |
| `npm.cmd run build` | 통과, 큰 JavaScript 번들 경고. 빌드 뒤 `scripts/check-dist.mjs`가 `dist` 10개 파일에서 샘플 계정 문자열 0건 확인 |
| `git diff --check` | 공백 오류 없음. Windows 줄바꿈 변환 경고 |
| `npm.cmd audit` | 취약점 0건 |
| `backend\.venv\Scripts\python.exe backend\scripts\smoke_api.py http://127.0.0.1:8765` | 통과 (임시 DB·`SEED_DEMO_DATA=true`·`COOKIE_SECURE=false`·`FRONTEND_DIST=../dist` 로컬 서버) |
| 빌드한 `dist`로 production 설정(`SEED_DEMO_DATA=false`) uvicorn 실행 후 `curl` | `/`·`/play/home`·`/therapist/login`·JS 파일에 CSP(`frame-ancestors 'none'` 포함)·`X-Frame-Options: DENY`·`nosniff`·`Referrer-Policy` HTTP 헤더 확인. `/api/auth/demo-login` 404 |

Windows 기본 pytest 임시 디렉터리에 접근 거부가 발생해 작업 폴더 안의 `backend/test-temp`를 지정했다. 이 폴더는 `.gitignore`로 추적하지 않는다.

## 구현·검증 범위

- review §8.1 A–F: 브라우저 음향 범위, 무발화 우선 처리, 요청 크기·헤더 오류, 서버 SNR 재계산, 유성/마찰 구분, 마지막 항목의 불확실 반복 종료를 API·단위 테스트로 확인했다.
- 입력 검증: 범위 밖·문자열·비유한 수·중첩 데이터·과대 요청을 4xx로 거부하고, 거부된 발화는 저장하거나 세션 상태에 반영하지 않는다.
- 보안: 역할별 쿠키 세션, CSRF·Origin 검사, IDOR 차단, 세션 만료·로그아웃 무효화, 로그인 시도 제한을 테스트했다. 운영 기본값은 Secure 쿠키와 데모 데이터 비활성화다.
- 공통 3D 호야, 음성 신호→게임 행동 매핑, 700ms 발화 종료 유예, 친근한 재시도 문구를 코드에 연결했다.
- 네 게임 각각 5라운드의 서버 정의·진행·종료 API와 DEMO 화면을 만들었다. 라운드·불확실 건너뛰기·진행 종료를 테스트했다.
- 발화와 임상 관찰을 같은 DB 트랜잭션에 저장한다. 치료사 확인·교정·거부는 원래 AI 결과를 보존한 별도 이력·감사 이벤트로 저장한다. 세션별 타임라인과 라운드 표본 수를 제공한다.
- 치료사 확인 비율: 확인·교정된 관찰 중 `success`/`retry`만 분모로 쓴다. 불확실·무발화·대화 속 목표 관찰은 실패로 세지 않고 `verifiedEvaluatedN`·`verifiedObservedN`으로 따로 보여 준다(`test_clinical_integrity.py`).
- 음성 자료 삭제: 발화·분석과 함께 파생된 임상 관찰, 치료사 검증 이력, 활동 제안을 지우고 감사 이벤트를 남긴다. 삭제 뒤 FK 위반이 없고 다른 아동 자료는 유지됨을 테스트했다.
- **Hardening (merge 이후)**
  - 세션 종류: 기존 모험 API에 5라운드 세션을, 5라운드 API에 기존 모험 세션을 넣으면 409다. 없는 세션은 404다(`test_hardening.py`). 리뷰에서 `currentItem.level`·`game` 누락, 중첩 타입 오류, 완료 처리 시 xp 문자열이 여전히 500임을 재현했다. 상태 schema를 pydantic으로 명시(항목 필드·대기열·재시도·라운드 스냅숏·완료 요약)하고, 네 play 엔드포인트에 예상하지 못한 KeyError·TypeError·IndexError 등을 409로 바꾸고 롤백하는 안전 경계를 두었다(`test_review_blockers.py`).
  - Monster Adventure R4: 모든 라운드 항목은 훈련 단어 목록(`itemSource: TRAINING_BANK`)에서 나온다. 미훈련 단어를 보장하지 않으므로 "새 장면에서 훈련 단어 산출"로 이름을 바꿨다. 같은 세션의 R2·R3·R4 단어는 겹치지 않는다.
  - 실제 마이크 규칙: CONTINUITY·PULSES·TRANSITION·ENERGY_BAND·RE_ONSET을 `source: microphone` API 경로로 성공·재시도 모두 테스트했다. Sky Climb R4는 기본 700ms 유예에서 1.2초 쉼이 발화를 끝내 "쉬었다가 다시"가 구조적으로 어려웠다. 이 라운드만 발화 종료 유예를 2.5초로 늘렸고(Magic Beam R4는 1.2초), 판정은 목표 길이 구간 2개와, 한 발화 안의 가장 긴 쉼 300~2200ms다(상한 < 유예 2.5초). 리뷰에서 VAD가 쉼·종료 유예의 무음까지 평균 음량에 넣어 정상 재발성(약 2.2초 -40dB + 약 3.8초 무음)이 LOW_SNR로 떨어지는 문제를 확인했다. 신호 통계는 발성 frame만, 발화 길이는 마지막 발성 frame까지로 바꿨다. 브라우저 경로(`MicUtterancePipeline`, ActivitySession이 쓰는 코드)에 frame 시나리오(짧은 쉼·자연스러운 쉼·최대 인정 쉼·유예보다 긴 쉼·재개 없음·짧은 소리·무음)를 흘려 요약을 만들고(`shared/re_onset_mic_cases.json`), 백엔드가 같은 요약을 API로 평가한다. 이전 VAD에서는 이 프론트 테스트 9개가 실패했다.
  - DEMO 관찰: 카드에 "DEMO · 실제 음성 자료 아님 · 임상 검증 통계 제외"를 표시한다. 검토는 기록되지만 상태가 `DEMO_CONFIRMED` 등으로 남고 요약·활동 제안에 쓰이지 않는다.
  - 임상 요약: `totalObservedN`·`evaluableN`·`uncertainN`·`noSpeechN`·`targetObservedN`으로 나눴다. `limitedData`는 평가 가능 표본 5개 미만이다. 활동 제안의 SOUND 지속 평균은 성공·재시도로 확인된 관찰만 쓴다.
  - 로그인: 없는 계정도 더미 해시 검증을 한다. 15분 창에서 IP+아이디 5회·아이디 10회·IP 30회 실패 시 429다. 오류 문구는 계정 존재와 무관하게 같다. 리뷰에서 프로덕션 번들에 샘플 계정 문자열이 들어 있음을 확인했다. 프런트엔드에서 샘플 계정 정보를 모두 지우고 서버 `POST /api/auth/demo-login`(DEMO 모드에서만)으로 바꿨다. DEMO 모드가 꺼지면 기존 DB의 샘플 계정은 로그인과 기존 세션 모두 거부된다. `npm.cmd run build`가 `dist`에 금지 문자열이 있으면 실패한다.
  - 보존 기간: 삭제를 `app/maintenance.py`로 분리했다. 서버 시작 시와 켜져 있는 동안 24시간(설정 가능)마다 실행한다. 서버가 꺼진 동안은 실행되지 않는다.
  - 보안 헤더: 보안 헤더 미들웨어를 가장 바깥에 두어 400·403·413 조기 응답과 401·422에도 CSP를 포함한 헤더가 붙는다. 프로덕션 빌드 `index.html`에 CSP meta를 넣는다. 리뷰 지적대로 meta로는 `frame-ancestors`가 적용되지 않는다. 공식 production 경로를 "FastAPI가 `FRONTEND_DIST`를 서비스"로 정하고, 화면 응답(`/`, SPA 경로, `/assets`)에도 `frame-ancestors 'none'`을 포함한 CSP·`X-Frame-Options` 등을 HTTP 헤더로 붙였다. 빌드한 `dist`로 실제 uvicorn을 띄워 `/`, `/play/home`, `/therapist/login`, JS 파일, API 응답의 헤더를 확인했다. 번들에는 `eval`·`new Function`·inline script가 없어 `script-src 'self'`로 동작한다.
  - 실제 음성 기능: `MIC_AVAILABLE`·`ACOUSTIC_AVAILABLE`·`ASR_AVAILABLE`을 따로 판단한다. Magic Beam·Sky Climb은 음성 인식 없이도 실제 음성 모드를 쓸 수 있고, 지원하지 않는 게임은 버튼이 꺼진다.
  - 3D 호야: WebGL 판별, ErrorBoundary, 컨텍스트 손실 처리로 간단한 대체 화면을 보여 준다. 대체 화면은 3D 렌더가 아니다.
- 대화 게임의 응답은 고정된 안전한 DEMO 규칙을 사용한다. 목표 단어가 없는 응답은 이야기만 진행하고 임상 점수·관찰을 만들지 않는다.

## 남은 한계와 판정

- **실물 마이크·Android 브라우저·3D 렌더 수동 확인: NOT MANUALLY VERIFIED.** 자동 테스트는 화면 렌더와 실제 기기 음질을 보증하지 않는다. 2.5초 유예가 아동에게 자연스러운지, 대체 화면이 실제 WebGL 실패 기기에서 뜨는지, 새 치료사 화면 표시도 사람이 확인해야 한다.
- **발음 정확도·임상 효능: NOT VALIDATED — NO LABELED DATA.** 음향 및 ASR 판정은 기초 근사다.
- 네 게임의 기본 5라운드 경로는 자동 테스트로 확인했으나, 게임별 세부 장면·콘텐츠·단서 단계·상호작용·성능 예산은 계획의 전 범위를 채우지 못했다. **게임 track = PARTIAL.**
- 대화는 안전한 DEMO 응답이며 실제 대화 모델 제공자, 문맥 기억, 임상적 일반화 판정은 구현되지 않았다.
- 데이터베이스는 SQLAlchemy의 신규 테이블 생성 방식을 사용한다. 운영 배포용 Alembic 버전 마이그레이션·기존 데이터 이전 절차는 남았다.
- 로컬 API 서버에서 쿠키 로그인·CSRF·5라운드 smoke를 확인했다. 실제 HTTPS·리버스 프록시 뒤에서의 쿠키·헤더 전달과, 실제 브라우저에서 CSP가 React·three.js 화면을 막지 않는지는 아직 확인하지 않았다(NOT MANUALLY VERIFIED).

현재 판정: **M1 PARTIAL / M2 PARTIAL / M3 PARTIAL · production READY 아님.** 임상용 검증이 끝난 상태로 표시하지 않는다.
