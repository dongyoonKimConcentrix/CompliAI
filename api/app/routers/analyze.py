from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.analyzer import analyze_text

router = APIRouter(prefix="/analyze", tags=["AI Analysis"])


@router.post("", response_model=AnalyzeResponse)
async def analyze_content(
    request: AnalyzeRequest,
    session: Session = Depends(get_session),
):
    return await analyze_text(request, session)
