from pydantic_settings import BaseSettings, SettingsConfigDict


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
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
