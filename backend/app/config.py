from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str = "dev-only-change-me"
    database_url: str = "sqlite:///./speech_hero.db"
    cors_origins: str = "http://localhost:5173"
    seed_demo_data: bool = True
    transcript_retention_days: int = 90
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
