from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class AIAnalysisLog(SQLModel, table=True):
    __tablename__ = "ai_analysis_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    content_type: str = Field(index=True)  # post | comment
    content_id: int = Field(index=True)
    text: str
    sarcasm_score: int = 0
    aggression: bool = False
    is_blocked: bool = False
    ai_report: str = "{}"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_settings"

    key: str = Field(primary_key=True)
    value: str
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    updatedBy: Optional[str] = None
