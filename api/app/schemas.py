from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    content_type: str = Field(..., pattern="^(post|comment)$")
    content_id: int | None = None


class AnalyzeResponse(BaseModel):
    sarcasm_score: int = Field(..., ge=0, le=100)
    aggression: bool
    is_blocked: bool
    ai_report: dict
    message: str
