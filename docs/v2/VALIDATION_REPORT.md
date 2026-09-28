# Speech Hero V2 검증 기록

기준 브랜치: `feature/speech-hero-v2-tiger` · 2026-09-28

## 자동 검증

| 명령 | 실행 결과 |
|---|---|
| `backend\.venv\Scripts\python.exe -m pytest backend -q --basetemp backend/test-temp -p no:cacheprovider` | 90개 통과, 경고 2개 |
| `npm.cmd run typecheck` | 통과 |
| `npm.cmd test` | 14개 통과 |
| `npm.cmd run build` | 통과, 큰 JavaScript 번들 경고 |
| `git diff --check` | 공백 오류 없음. Windows 줄바꿈 변환 경고 |

Windows 기본 pytest 임시 디렉터리에 접근 거부가 발생해 작업 폴더 안의 `backend/test-temp`를 지정했다. 이 폴더는 추적하지 않는다.

## 구현·검증 범위

- review §8.1 A–F: 브라우저 음향 범위, 무발화 우선 처리, 요청 크기·헤더 오류, 서버 SNR 재계산, 유성/마찰 구분, 마지막 항목의 불확실 반복 종료를 API·단위 테스트로 확인했다.
- 입력 검증: 범위 밖·문자열·비유한 수·중첩 데이터·과대 요청을 4xx로 거부하고, 거부된 발화는 저장하거나 세션 상태에 반영하지 않는다.
- 보안: 역할별 쿠키 세션, CSRF·Origin 검사, IDOR 차단, 세션 만료·로그아웃 무효화, 로그인 시도 제한을 테스트했다. 운영 기본값은 Secure 쿠키와 데모 데이터 비활성화다.
- 공통 3D 호야, 음성 신호→게임 행동 매핑, 700ms 발화 종료 유예, 친근한 재시도 문구를 코드에 연결했다.
- 네 게임 각각 5라운드의 서버 정의·진행·종료 API와 DEMO 화면을 만들었다. 라운드·불확실 건너뛰기·진행 종료를 테스트했다.
- 발화와 임상 관찰을 같은 DB 트랜잭션에 저장한다. 치료사 확인·교정·거부는 원래 AI 결과를 보존한 별도 이력·감사 이벤트로 저장한다. 세션별 타임라인과 라운드 표본 수를 제공한다.
- 치료사 확인 비율: 확인·교정된 관찰 중 `success`/`retry`만 분모로 쓴다. 불확실·무발화·대화 속 목표 관찰은 실패로 세지 않고 `verifiedEvaluatedN`·`verifiedObservedN`으로 따로 보여 준다(`test_clinical_integrity.py`).
- 음성 자료 삭제: 발화·분석과 함께 파생된 임상 관찰, 치료사 검증 이력, 활동 제안을 지우고 감사 이벤트를 남긴다. 삭제 뒤 FK 위반이 없고 다른 아동 자료는 유지됨을 테스트했다.
- 대화 게임의 응답은 고정된 안전한 DEMO 규칙을 사용한다. 목표 단어가 없는 응답은 이야기만 진행하고 임상 점수·관찰을 만들지 않는다.

## 남은 한계와 판정

- **실물 마이크·Android 브라우저·3D 렌더 수동 확인: NOT MANUALLY VERIFIED.** 자동 테스트는 화면 렌더와 실제 기기 음질을 보증하지 않는다.
- **발음 정확도·임상 효능: NOT VALIDATED — NO LABELED DATA.** 음향 및 ASR 판정은 기초 근사다.
- 네 게임의 기본 5라운드 경로는 자동 테스트로 확인했으나, 게임별 세부 장면·콘텐츠·단서 단계·상호작용·성능 예산은 계획의 전 범위를 채우지 못했다. **게임 track = PARTIAL.**
- 대화는 안전한 DEMO 응답이며 실제 대화 모델 제공자, 문맥 기억, 임상적 일반화 판정은 구현되지 않았다.
- 데이터베이스는 SQLAlchemy의 신규 테이블 생성 방식을 사용한다. 운영 배포용 Alembic 버전 마이그레이션·기존 데이터 이전 절차는 남았다.
- 로컬 API 서버에서 쿠키 로그인·CSRF·5라운드 smoke를 확인했다. `npm audit`은 취약점 0건이었다. 실제 HTTPS 배포 환경에서의 쿠키 동작과 PR 생성은 아직 확인하지 않았다.

현재 판정: **M1 PARTIAL / M2 PARTIAL / M3 PARTIAL · production READY 아님.** 임상용 검증이 끝난 상태로 표시하지 않는다.
