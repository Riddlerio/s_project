from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


# 로컬 dotenv는 실행 위치와 관계없이 backend/.env 하나다. OS 환경 변수가 dotenv보다 우선한다.
# 파일이 없으면 무시하므로 운영 환경은 OS 환경 변수만으로 실행할 수 있다.
BACKEND_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    secret_key: str = "dev-only-change-me"
    database_url: str = "sqlite:///./speech_hero.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_demo_data: bool = False
    transcript_retention_days: int = 90
    cookie_secure: bool = True
    transcript_purge_interval_hours: float = 24
    login_window_minutes: int = 15
    login_max_failures_pair: int = 5
    login_max_failures_username: int = 10
    login_max_failures_ip: int = 30
    content_security_policy: str = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    # 프로덕션에서 빌드된 프런트엔드(dist) 경로. 비어 있으면 API만 서비스한다.
    frontend_dist: str = ""
    # 호야와 대화하기. 꺼져 있거나 key·model이 없으면 외부 LLM 없이 DemoProvider를 쓴다.
    hoya_chat_enabled: bool = False
    hoya_chat_provider: str = "openai"
    hoya_chat_model: str = ""
    openai_api_key: SecretStr = SecretStr("")
    hoya_chat_timeout_sec: float = 8.0
    hoya_chat_max_turns: int = 30
    # 이 시간이 지나도 PROCESSING인 turn(서버 중단 등)은 외부 제공자를 다시 부르지 않고 DEMO 응답으로 마무리한다.
    hoya_chat_stale_sec: float = 30.0
    # 치료사 회기 계획 요약. 꺼져 있거나 model·key가 없으면 LLM 없이 결정적 템플릿 요약을 쓴다.
    therapist_summary_enabled: bool = False
    therapist_summary_model: str = ""
    therapist_summary_timeout_sec: float = 10.0
    model_config = SettingsConfigDict(env_file=BACKEND_ENV_FILE, env_file_encoding="utf-8", extra="ignore")


settings = Settings()
