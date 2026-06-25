from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    content_type: str = Field(..., pattern="^(post|comment)$")
    content_id: int | None = None


class EvaluationResult(BaseModel):
    """OpenAI Chain-of-Thought 분석 결과."""

    detected_irony: str = Field(description="표면 단어와 실제 행동/맥락 사이의 모순·비아냥 요소")
    hidden_intent: str = Field(description="작성자가 숨긴 진짜 부정적 의도·저격 목적")
    reason: str = Field(description="최종 판단 요약")
    suggestions: str = Field(description="더 건설적인 표현 제안")
    sarcasm_score: int = Field(..., ge=0, le=100, description="최종 부정적 뉘앙스 점수")
    aggression: bool = Field(description="공격성 유무")


class AnalyzeResponse(BaseModel):
    sarcasm_score: int = Field(..., ge=0, le=100)
    aggression: bool
    is_blocked: bool
    ai_report: dict
    message: str
