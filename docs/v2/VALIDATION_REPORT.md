# Speech Hero V2 검증 기록

기준 브랜치: `feature/speech-hero-v2-hardening` (PR #2 merge 이후) · 2026-09-28

## 자동 검증

| 명령 | 실행 결과 |
|---|---|
| `backend\.venv\Scripts\python.exe -m pytest backend -q --basetemp backend/test-temp -p no:cacheprovider` | 132개 통과, 경고 2개 |
| `npm.cmd run typecheck` | 통과 |
| `npm.cmd test` | 33개 통과 (9개 파일) |
| `npm.cmd run build` | 통과, 큰 JavaScript 번들 경고 |
| `git diff --check` | 공백 오류 없음. Windows 줄바꿈 변환 경고 |
| `npm.cmd audit` | 취약점 0건 |
| `backend\.venv\Scripts\python.exe backend\scripts\smoke_api.py http://127.0.0.1:8765` | 통과 (임시 DB·`SEED_DEMO_DATA=true`·`COOKIE_SECURE=false` 로컬 서버) |

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
  - 세션 종류: 기존 모험 API에 5라운드 세션을, 5라운드 API에 기존 모험 세션을 넣으면 409다. 손상된 상태(누락·잘못된 타입·범위 밖 라운드·잘못된 시각)도 500 대신 409다. 없는 세션은 404다(`test_hardening.py`).
  - Monster Adventure R4: 모든 라운드 항목은 훈련 단어 목록(`itemSource: TRAINING_BANK`)에서 나온다. 미훈련 단어를 보장하지 않으므로 "새 장면에서 훈련 단어 산출"로 이름을 바꿨다. 같은 세션의 R2·R3·R4 단어는 겹치지 않는다.
  - 실제 마이크 규칙: CONTINUITY·PULSES·TRANSITION·ENERGY_BAND·RE_ONSET을 `source: microphone` API 경로로 성공·재시도 모두 테스트했다. Sky Climb R4는 기본 700ms 유예에서 1.2초 쉼이 발화를 끝내 "쉬었다가 다시"가 구조적으로 어려웠다. 이 라운드만 발화 종료 유예를 2.5초로 늘렸고(Magic Beam R4는 1.2초), 판정은 목표 길이 구간 2개와 300~4000ms 쉼이다. 짧은 끊김·자연스러운 쉼·긴 쉼·재개 없음·무발화·불확실을 API·VAD·SustainTracker 테스트로 확인했다.
  - DEMO 관찰: 카드에 "DEMO · 실제 음성 자료 아님 · 임상 검증 통계 제외"를 표시한다. 검토는 기록되지만 상태가 `DEMO_CONFIRMED` 등으로 남고 요약·활동 제안에 쓰이지 않는다.
  - 임상 요약: `totalObservedN`·`evaluableN`·`uncertainN`·`noSpeechN`·`targetObservedN`으로 나눴다. `limitedData`는 평가 가능 표본 5개 미만이다. 활동 제안의 SOUND 지속 평균은 성공·재시도로 확인된 관찰만 쓴다.
  - 로그인: 없는 계정도 더미 해시 검증을 한다. 15분 창에서 IP+아이디 5회·아이디 10회·IP 30회 실패 시 429다. 오류 문구는 계정 존재와 무관하게 같다. DEMO 계정 안내는 서버가 `SEED_DEMO_DATA=true`일 때만 보이고 입력칸은 미리 채우지 않는다.
  - 보존 기간: 삭제를 `app/maintenance.py`로 분리했다. 서버 시작 시와 켜져 있는 동안 24시간(설정 가능)마다 실행한다. 서버가 꺼진 동안은 실행되지 않는다.
  - 보안 헤더: 보안 헤더 미들웨어를 가장 바깥에 두어 400·403·413 조기 응답과 401·422에도 CSP를 포함한 헤더가 붙는다. 프로덕션 빌드 `index.html`에 CSP meta를 넣는다. `frame-ancestors`는 배포 서버 헤더로 설정해야 한다.
  - 실제 음성 기능: `MIC_AVAILABLE`·`ACOUSTIC_AVAILABLE`·`ASR_AVAILABLE`을 따로 판단한다. Magic Beam·Sky Climb은 음성 인식 없이도 실제 음성 모드를 쓸 수 있고, 지원하지 않는 게임은 버튼이 꺼진다.
  - 3D 호야: WebGL 판별, ErrorBoundary, 컨텍스트 손실 처리로 간단한 대체 화면을 보여 준다. 대체 화면은 3D 렌더가 아니다.
- 대화 게임의 응답은 고정된 안전한 DEMO 규칙을 사용한다. 목표 단어가 없는 응답은 이야기만 진행하고 임상 점수·관찰을 만들지 않는다.

## 남은 한계와 판정

- **실물 마이크·Android 브라우저·3D 렌더 수동 확인: NOT MANUALLY VERIFIED.** 자동 테스트는 화면 렌더와 실제 기기 음질을 보증하지 않는다. 2.5초 유예가 아동에게 자연스러운지, 대체 화면이 실제 WebGL 실패 기기에서 뜨는지, 새 치료사 화면 표시도 사람이 확인해야 한다.
- **발음 정확도·임상 효능: NOT VALIDATED — NO LABELED DATA.** 음향 및 ASR 판정은 기초 근사다.
- 네 게임의 기본 5라운드 경로는 자동 테스트로 확인했으나, 게임별 세부 장면·콘텐츠·단서 단계·상호작용·성능 예산은 계획의 전 범위를 채우지 못했다. **게임 track = PARTIAL.**
- 대화는 안전한 DEMO 응답이며 실제 대화 모델 제공자, 문맥 기억, 임상적 일반화 판정은 구현되지 않았다.
- 데이터베이스는 SQLAlchemy의 신규 테이블 생성 방식을 사용한다. 운영 배포용 Alembic 버전 마이그레이션·기존 데이터 이전 절차는 남았다.
- 로컬 API 서버에서 쿠키 로그인·CSRF·5라운드 smoke를 확인했다. 실제 HTTPS 배포 환경의 쿠키·CSP·`frame-ancestors` 헤더 동작은 아직 확인하지 않았다.

현재 판정: **M1 PARTIAL / M2 PARTIAL / M3 PARTIAL · production READY 아님.** 임상용 검증이 끝난 상태로 표시하지 않는다.
