import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://myuser:mypassword@localhost:5432/compliai_db"
    openai_api_key: str = ""
    sarcasm_threshold: int = 70


@lru_cache
def get_settings() -> Settings:
    return Settings(
        database_url=os.getenv("DATABASE_URL", "postgresql://myuser:mypassword@localhost:5432/compliai_db"),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        sarcasm_threshold=int(os.getenv("SARCASM_THRESHOLD", "70")),
    )
