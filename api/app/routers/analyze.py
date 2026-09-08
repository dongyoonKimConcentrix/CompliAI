from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.analyzer import analyze_text

router = APIRouter(tags=["AI Analysis"])


@router.post("/analyze", response_model=AnalyzeResponse)
@router.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_content(
    request: AnalyzeRequest,
    session: Session = Depends(get_session),
):
    """게시글/댓글 텍스트의 비꼼 점수와 공격성을 분석합니다."""
    return await analyze_text(request, session)
