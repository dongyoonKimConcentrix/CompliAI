from fastapi import APIRouter, Query
from sqlmodel import select

from app.deps import AuthUser, DBSession
from app.models import User, UserRole

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/praise-targets")
def praise_targets(user: AuthUser, session: DBSession, q: str = Query(default="")):
    query = q.strip()
    stmt = select(User).where(
        User.role == UserRole.USER,
        User.id != user.id,
        User.emailVerified != None,  # noqa: E711
    )
    if query:
        stmt = stmt.where(User.name.ilike(f"%{query}%"))
    users = session.exec(stmt.order_by(User.name.asc()).limit(30)).all()
    return {"users": [{"id": u.id, "name": u.name} for u in users]}
