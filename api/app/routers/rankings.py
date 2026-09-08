from fastapi import APIRouter, HTTPException, Query

from app.deps import AuthUser, DBSession
from app.services.domain import get_kst_now
from app.services.rankings import get_monthly_ranking
from app.services.settings import get_sarcasm_threshold

router = APIRouter(tags=["Rankings"])


@router.get("/api/rankings/monthly")
def monthly_ranking(
    user: AuthUser,
    session: DBSession,
    year: int | None = None,
    month: int | None = None,
):
    now_year, now_month = get_kst_now()
    year = year or now_year
    month = month or now_month
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="유효하지 않은 연월입니다.")
    ranking = get_monthly_ranking(session, year, month)
    my_rank = next((entry for entry in ranking["leaders"] if entry["userId"] == user.id), None)
    return {**ranking, "myRank": my_rank}


@router.get("/api/settings/threshold")
def threshold(user: AuthUser, session: DBSession):
    return {"threshold": get_sarcasm_threshold(session)}
