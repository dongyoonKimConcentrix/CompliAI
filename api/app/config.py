import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://myuser:mypassword@localhost:5432/compliai_db"
    openai_api_key: str = ""
    sarcasm_threshold: int = 70
    jwt_secret: str = "change-me"
    jwt_expire_days: int = 30
    app_url: str = "http://localhost:3000"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_secure: bool = False
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""
    cron_secret: str = ""
    upload_dir: str = "uploads"


@lru_cache
def get_settings() -> Settings:
    jwt_secret = os.getenv("JWT_SECRET") or os.getenv("NEXTAUTH_SECRET") or "change-me"
    smtp_secure = os.getenv("SMTP_SECURE", "false").lower() in ("1", "true", "yes")
    return Settings(
        database_url=os.getenv(
            "DATABASE_URL", "postgresql://myuser:mypassword@localhost:5432/compliai_db"
        ),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        sarcasm_threshold=int(os.getenv("SARCASM_THRESHOLD", "70")),
        jwt_secret=jwt_secret,
        jwt_expire_days=int(os.getenv("JWT_EXPIRE_DAYS", "30")),
        app_url=(os.getenv("APP_URL") or os.getenv("NEXTAUTH_URL") or "http://localhost:3000").rstrip(
            "/"
        ),
        smtp_host=os.getenv("SMTP_HOST", ""),
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_secure=smtp_secure,
        smtp_user=os.getenv("SMTP_USER", ""),
        smtp_password=os.getenv("SMTP_PASSWORD", ""),
        email_from=os.getenv("EMAIL_FROM") or os.getenv("SMTP_USER") or "",
        cron_secret=os.getenv("CRON_SECRET", ""),
        upload_dir=os.getenv("UPLOAD_DIR", "uploads"),
    )
