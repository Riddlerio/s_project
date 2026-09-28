# Speech Hero

Speech Hero는 만 4~7세 아동이 음성으로 호야와 네 가지 게임을 진행하고, 치료사가 관찰 근거를 검토해 목표를 조정하는 웹 앱입니다. 아동에게 임상 점수를 보여주지 않고, 치료사 화면에서 발화·결정·추천의 근거를 확인합니다.

핵심 원칙은 **음성이 게임을 움직인다**, **아동에게는 모험으로 보인다**, **치료사의 판단이 다음 훈련에 반영된다**입니다. 캐릭터는 동행자이며 치료사나 의사의 역할을 하지 않습니다.

## 주요 기능

- 아동: 계정 로그인, 3D 호야 홈, 네 게임의 5라운드, DEMO 또는 실제 음성 입력, XP·뱃지·카드 확인
- 치료사: 로그인, 아동과 목표 관리, 세션 기록·진행 지표 확인, AI 추천 수락·수정·거절, 발화 교정과 규칙 비활성화
- 서버: FastAPI·SQLite, 쿠키 세션·역할 접근 제어·CSRF 방어, 발화 분석, 라운드 이벤트와 임상 관찰·치료사 검증 기록

음향·발음 판정은 **기초 근사 분석**이며 임상 진단이나 치료사의 판단을 대체하지 않습니다. 5라운드 난이도 규칙은 제품 운영 규칙입니다. 원본 음성은 앱 서버에 저장하지 않습니다. 실제 음성 모드에서 브라우저의 Web Speech API 제공업체로 음성이 전송될 수 있습니다. DEMO는 스크립트 인식 결과를 사용하며 아동 화면에 명시됩니다. 외부 LLM이나 학습 모델 재훈련은 사용하지 않습니다.

## 구조와 음성 처리

브라우저 `src/child`가 마이크 입력의 음량과 발성 시간을 감지합니다. Magic Beam의 실제 마이크 입력은 고주파 에너지와 스펙트럼 중심으로 마찰음 구간을 찾고 연속 발성 길이를 서버에 보냅니다. 신호 대 잡음비가 낮거나 발화가 너무 짧으면 평가를 보류하고 다시 듣기를 안내합니다. 이 임계값은 기기별 보정과 실제 아동 음성 검증이 필요합니다. 실제 모드에서는 Web Speech API가 한국어 인식 문장을 만들고, DEMO 모드에서는 `DemoRecognizer`가 같은 인터페이스로 문장을 만듭니다. 서버는 문장을 정규화하고 한글 음소로 변환한 뒤 목표와 정렬하여 근사 점수와 재시도 패턴을 계산합니다. `TrainingPolicy`는 치료사가 정한 목표 범위 안에서 다음 항목·힌트·보상 시점을 정하고, 정규화된 `GameEvent`가 몬스터 타워와 마법 빔에 전달됩니다. 발화·분석·결정·이벤트는 SQLite에 저장되고 치료사 대시보드에 표시됩니다.

치료사 추천은 관찰·근거·신뢰도·제안을 보여 줍니다. 수락이나 수정 때만 새 목표 버전이 만들어지고, 거절은 사유와 함께 기록됩니다. 추천 자체가 목표를 자동 변경하지 않습니다. 자세한 구조는 [아키텍처](docs/ARCHITECTURE.md)에 있습니다.

## 사전 요구사항

- Node.js 22.12 이상과 npm
- Python 3.11 이상 및 `pip`
- 실제 음성 모드에는 Web Speech API를 지원하는 브라우저와 마이크 권한

## 설치 방법

저장소 루트에서 프런트엔드 의존성을 설치하고, `backend`에서 Python 의존성을 설치합니다. Windows PowerShell에서 스크립트 실행이 제한되어 있으면 `npm.cmd`를 사용합니다.

```powershell
npm.cmd install
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

이 작업 환경에서는 `npm.cmd install`과 백엔드 의존성 설치를 확인했습니다. 가상환경에 `pip`가 없으면 `.venv\Scripts\python.exe -m ensurepip --upgrade` 후 설치 명령을 다시 실행합니다.

## 실행 방법

로컬 HTTP 시연에서는 `backend/.env`에 `SEED_DEMO_DATA=true`와 `COOKIE_SECURE=false`를 설정합니다. 운영 환경은 HTTPS와 `COOKIE_SECURE=true`를 사용하고 데모 데이터 생성을 끕니다. 각각 별도 터미널에서 실행합니다.

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
npm.cmd run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다. 데모 치료사 계정은 `demo / speechhero`, 첫 아동 계정은 `HERO01 / speechhero`입니다. 프런트엔드 개발 서버는 `/api`를 백엔드로 전달합니다. 새 아동 등록 시 생성되는 임시 비밀번호는 치료사에게 한 번만 표시됩니다. 기존 DB의 계정은 `cd backend; .venv\Scripts\python.exe -m scripts.provision_account <아이디> <STUDENT|THERAPIST|ADMIN> --child-id <ID>` 형식으로 생성할 수 있습니다. 치료사 계정은 `--therapist-id`를 사용합니다.

## 사용 방법

1. 아동 계정으로 로그인해 호야 홈을 거쳐 모험 지도를 엽니다.
2. DEMO를 선택하면 `Space`를 누르는 동안 발성합니다. 마이크가 없을 때도 `Space`로 발성 시간을 입력할 수 있으며 음성 인식 결과는 스크립트입니다.
3. 실제 음성 모드를 선택하면 마이크 권한을 허용합니다. 발성 시작과 끝을 감지해 게임이 진행됩니다.
4. 치료사 화면에서 세션 기록과 추천 근거를 확인하고 목표를 결정합니다. 목표 변경은 다음 세션에 적용됩니다.

## 테스트 방법

저장소 루트에서 다음 명령을 실행합니다.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
backend\.venv\Scripts\python.exe -m pytest backend -q
backend\.venv\Scripts\python.exe backend\scripts\smoke_api.py
```

pytest가 Windows 기본 임시 폴더 접근 오류를 내면 `--basetemp backend/test-temp -p no:cacheprovider`를 덧붙여 실행합니다. 2026-09-28 검증에서는 백엔드 84개 테스트, 프런트엔드 14개 테스트, 타입 검사와 빌드가 통과했습니다. 실물 마이크와 브라우저 3D 렌더는 수동 검증하지 않았습니다. 최신 결과와 남은 한계는 [V2 검증 기록](docs/v2/VALIDATION_REPORT.md)에 있습니다.

## 환경 변수와 API

백엔드는 `backend/.env.example`을 참고합니다. `.env`는 커밋하지 않습니다. `DATABASE_URL`은 SQLite 주소, `CORS_ORIGINS`는 허용할 프런트엔드 주소, `SEED_DEMO_DATA`는 샘플 데이터 생성 여부, `COOKIE_SECURE`는 HTTPS 전용 쿠키 여부입니다. 기본값은 샘플 데이터 비활성화와 보안 쿠키 활성화입니다.

주요 경로는 `/api/auth/login`, `/api/auth/logout`, `/api/me/home`, `/api/activities`, `/api/activities/{id}/utterances`, `/api/sessions/{id}/timeline`, `/api/sessions/{id}/clinical-summary`, `/api/observations/{id}/decision`입니다. 로그인은 HttpOnly·SameSite 쿠키를 설정하고 응답의 CSRF 값을 이후 변경 요청의 `X-CSRF-Token` 헤더에 사용합니다. 역할과 아동 배정은 서버 DB가 결정합니다. `/api/system/info`와 `http://127.0.0.1:8000/docs`에서 API 정보를 확인할 수 있습니다.

## 프로젝트 구조

- `src/child`, `src/speech`, `src/character`: 아동 화면과 음성 입력
- `src/therapist`: 치료사 화면
- `backend/app/training`, `backend/app/speech`, `backend/app/analysis`: 훈련 정책, 발화 분석, 진행 지표
- `backend/app/main.py`: API 및 세션 흐름
- `backend/tests`: 정책과 독립 테스트 DB를 쓰는 API 테스트
- `docs/ARCHITECTURE.md`: 구조와 데이터 흐름

## 문제 해결 방법

- 마이크를 사용할 수 없으면 DEMO 모드에서 `Space`로 발성 시간을 입력합니다.
- 실제 음성 인식을 지원하지 않는 브라우저에서는 DEMO 모드를 사용합니다.
- 포트가 사용 중이면 백엔드 포트와 `vite.config.ts`의 프록시 주소를 함께 변경합니다.
- 로컬 DB를 초기화하려면 앱을 중지한 뒤 `backend/speech_hero.db`를 삭제하고 재시작합니다. 이 작업은 저장된 세션을 지웁니다.

## 개인정보와 알려진 한계

원본 음성 파일은 서버에 저장하지 않지만 인식 문장과 발성 특징·세션 기록은 저장됩니다. 기본 보존 기간이 지나면 인식 문장을 비웁니다. 개발용 데모 계정은 운영 서비스에 사용할 수 없습니다. 실제 모드의 인식 품질은 브라우저·마이크·주변 소음에 영향을 받으며, Web Speech API가 발음을 표준 단어로 보정할 수 있습니다. 물리 마이크·3D 장면·배포 환경의 수동 검증과 라벨링된 아동 음성 데이터 기반 정확도 검증은 아직 완료되지 않았습니다.
