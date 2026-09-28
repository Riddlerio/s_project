# Speech Hero

Speech Hero는 만 4~7세 아동이 음성으로 몬스터 타워와 마법 빔을 진행하고, 치료사가 결과를 살펴 목표를 조정하는 시연용 웹 앱입니다. 아동에게 점수와 음소 분석을 보여주지 않고, 치료사 화면에서 발화·결정·추천의 근거를 확인합니다.

핵심 원칙은 **음성이 게임을 움직인다**, **아동에게는 모험으로 보인다**, **치료사의 판단이 다음 훈련에 반영된다**입니다. 캐릭터는 동행자이며 치료사나 의사의 역할을 하지 않습니다.

## 주요 기능

- 아동: 모험 코드로 입장, DEMO 또는 실제 음성 인식 선택, 발성으로 게임 진행, XP·뱃지·카드 확인
- 치료사: 로그인, 아동과 목표 관리, 세션 기록·진행 지표 확인, AI 추천 수락·수정·거절, 발화 교정과 규칙 비활성화
- 서버: FastAPI·SQLite, 발화 분석, 훈련 정책, 이벤트 기록, 목표 버전과 추천 루프

현재 구현은 MVP 시연 범위입니다. 점수는 **ASR 기반 근사 분석**이며 임상 진단이나 치료사의 판단을 대체하지 않습니다. 원본 음성은 앱 서버에 저장하지 않습니다. 실제 음성 모드에서 브라우저의 Web Speech API 제공업체로 음성이 전송될 수 있습니다. DEMO는 스크립트 인식 결과를 사용하며 아동 화면에 명시됩니다. 외부 LLM이나 학습 모델 재훈련은 사용하지 않습니다.

## 구조와 음성 처리

브라우저 `src/child`가 마이크 입력의 음량과 발성 시간을 감지합니다. 실제 모드에서는 Web Speech API가 한국어 인식 문장을 만들고, DEMO 모드에서는 `DemoRecognizer`가 같은 인터페이스로 문장을 만듭니다. 서버는 문장을 정규화하고 한글 음소로 변환한 뒤 목표와 정렬하여 근사 점수와 재시도 패턴을 계산합니다. `TrainingPolicy`는 치료사가 정한 목표 범위 안에서 다음 항목·힌트·보상 시점을 정하고, 정규화된 `GameEvent`가 몬스터 타워와 마법 빔에 전달됩니다. 발화·분석·결정·이벤트는 SQLite에 저장되고 치료사 대시보드에 표시됩니다.

치료사 추천은 관찰·근거·신뢰도·제안을 보여 줍니다. 수락이나 수정 때만 새 목표 버전이 만들어지고, 거절은 사유와 함께 기록됩니다. 추천 자체가 목표를 자동 변경하지 않습니다. 자세한 구조는 [아키텍처](docs/ARCHITECTURE.md)에 있습니다.

## 사전 요구사항

- Node.js 18 이상과 npm
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

각각 별도 터미널에서 실행합니다.

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
npm.cmd run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다. 데모 계정은 `demo / speechhero`, 첫 아동 모험 코드는 `HERO01`입니다. 프론트엔드 개발 서버는 로컬 주소에서만 접속을 받고 `/api`를 백엔드로 전달합니다.

## 사용 방법

1. 모험 코드를 입력하고 지도를 엽니다.
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

API smoke 명령은 백엔드 서버 실행 중에 사용합니다. 마지막 검증에서 프런트엔드 5개, 백엔드 13개 테스트와 빌드·API smoke가 통과했습니다. 브라우저 마이크로 실제 발음의 품질을 확인하는 수동 시험은 [실제 마이크 수동 시험](docs/manual-mic-test.md)에 정리했습니다. npm 취약점의 시연 환경 판단은 [보안 감사](docs/security-audit.md)에 있습니다.

## 환경 변수와 API

백엔드는 `backend/.env.example`을 참고합니다. `SECRET_KEY`는 운영 환경에서 별도 값으로 설정하고 `.env`는 커밋하지 않습니다. `DATABASE_URL`은 SQLite 주소, `CORS_ORIGINS`는 프런트엔드 주소, `SEED_DEMO_DATA`는 샘플 데이터 생성 여부입니다. 프런트엔드 개발 서버는 `/api`를 `127.0.0.1:8000`으로 전달합니다.

주요 경로는 `/api/system/info`, `/api/auth/login`, `/api/play/start`, `/api/play/sessions/{id}/utterances`, `/api/play/sessions/{id}/complete`, `/api/dashboard/overview`, `/api/sessions/{id}`, `/api/children/{id}/progress`, `/api/recommendations/{id}/decision`, `/api/utterances/{id}/feedback`입니다. 치료사 경로는 로그인 토큰이 필요합니다. `http://127.0.0.1:8000/docs`에서 요청 형식을 확인할 수 있습니다.

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

원본 음성 파일은 서버에 저장하지 않지만 인식 문장과 발성 특징·세션 기록은 저장됩니다. 기본 보존 기간이 지나면 인식 문장을 비웁니다. 개발용 데모 계정과 기본 비밀키는 운영 서비스에 사용할 수 없습니다. 샘플 세션은 대시보드에서 샘플로 표시됩니다. 실제 모드의 인식 품질은 브라우저·마이크·주변 소음에 영향을 받으며, Web Speech API가 발음을 표준 단어로 보정할 수 있습니다. 마이크 권한이 없거나 지원되지 않으면 새 세션에서 DEMO 모드를 선택할 수 있습니다. 브라우저 실물 마이크와 배포 환경의 인증·보안 검증은 아직 완료되지 않았습니다.
