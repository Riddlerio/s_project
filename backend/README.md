# 백엔드

FastAPI 서버와 데이터 저장·게임 판정·치료사 API를 담습니다. 서버 진입점은 `app/main.py`입니다.

- `app/`: API, 인증, 회기 상태, 게임·대화·치료사 분석 기능.
- `app/hoya/prompt/system_prompt.md`: 대화 기능이 실행 중 읽는 프롬프트 파일.
- `scripts/`: 계정 준비, 시연 DB 점검, API 점검 도구.
- `tests/`: API와 임상 데이터 경계 등을 확인하는 pytest 테스트.
- `.env.example`, `requirements.txt`, `pytest.ini`: 설정 예시, 의존성, 테스트 설정.

`app/hoya/prompt/system_prompt.md`와 저장소 루트의 `shared/`는 실행 코드가 직접 참조하므로 위치를 바꾸지 마세요. 설치·실행은 [빠른 시작](../README.md#빠른-시작), 테스트는 [검사 명령](../README.md#검사-명령)을 따릅니다.
