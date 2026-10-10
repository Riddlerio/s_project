"""테스트는 개발자 PC의 backend/.env를 읽지 않는다.

.env에는 실제 OpenAI 키, AI 대화·요약 켬, 로컬 DB 경로가 들어갈 수 있다. 테스트가 이를 따르면
결과가 PC마다 달라지고 실제 API를 부를 수 있다. 그래서 CI와 같이 기본값과 OS 환경 변수만 쓴다.
다른 모듈이 같은 settings 객체를 가져다 쓰므로, 앱 모듈을 불러오기 전에 그 자리에서 다시 읽는다.
"""
from app.config import settings

settings.__init__(_env_file=None)
