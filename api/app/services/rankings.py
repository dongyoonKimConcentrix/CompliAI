from sqlmodel import Session, select
from sqlalchemy import func

from app.models import Like, ModerationStatus, Post, User
from app.services.domain import build_leaderboard, get_kst_now, get_month_range_kst
from app.services.settings import get_sarcasm_threshold


def get_monthly_ranking(session: Session, year: int, month: int) -> dict:
    start, end = get_month_range_kst(year, month)
    now_year, now_month = get_kst_now()
    threshold = get_sarcasm_threshold(session)
    users = session.exec(select(User)).all()
    posts = session.exec(
        select(Post).where(
            Post.createdAt >= start,
            Post.createdAt < end,
            Post.sarcasmScore < threshold,
            Post.aggression == False,  # noqa: E712
            Post.moderationStatus == ModerationStatus.APPROVED,
        )
    ).all()

    praise_posts = []
    for post in posts:
        like_count = session.exec(
            select(func.count()).select_from(Like).where(Like.postId == post.id)
        ).one()
        praise_posts.append(
            {
                "authorId": post.authorId,
                "targetUserId": post.targetUserId,
                "sarcasmScore": post.sarcasmScore,
                "aggression": post.aggression,
                "likeCount": like_count,
            }
        )

    leaders = build_leaderboard(praise_posts, list(users))
    return {
        "period": {
            "year": year,
            "month": month,
            "label": f"{year}년 {month}월",
            "isCurrentMonth": year == now_year and month == now_month,
        },
        "leaders": leaders,
        "scoring": {
            "postPoints": 10,
            "likePoints": 1,
            "formula": "점수 = 칭찬 건수 × 10 + 좋아요 × 1",
        },
        "criteria": "긍정 칭찬만 집계 (부정적 뉘앙스 70점 미만·공격성 없음), 자기 칭찬 제외, 최초 작성 월 기준",
    }
