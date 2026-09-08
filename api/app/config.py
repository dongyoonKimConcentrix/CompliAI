import os
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_API_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_API_DIR / ".env", _API_DIR.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://myuser:mypassword@localhost:5432/compliai_db"
    openai_api_key: str = ""
    sarcasm_threshold: int = 70
    jwt_secret: str = Field(
        default="change-me",
        validation_alias=AliasChoices("JWT_SECRET", "NEXTAUTH_SECRET"),
    )
    jwt_expire_days: int = 30
    app_url: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("APP_URL", "NEXTAUTH_URL"),
    )
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_secure: bool = False
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""
    cron_secret: str = ""
    upload_dir: str = "uploads"

    @model_validator(mode="after")
    def normalize(self):
        if not self.email_from:
            object.__setattr__(self, "email_from", self.smtp_user)
        object.__setattr__(self, "app_url", (self.app_url or "http://localhost:3000").rstrip("/"))
        if not self.jwt_secret:
            object.__setattr__(self, "jwt_secret", "change-me")
        return self


@lru_cache
def get_settings() -> Settings:
    jwt_secret = os.getenv("JWT_SECRET") or os.getenv("NEXTAUTH_SECRET")
    loaded = Settings()
    if jwt_secret:
        object.__setattr__(loaded, "jwt_secret", jwt_secret)
    return loaded
