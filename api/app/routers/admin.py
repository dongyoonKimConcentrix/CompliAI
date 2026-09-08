from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import select

from app.deps import AdminUser, DBSession
from app.models import Comment, ModerationStatus, Post, User, UserRole
from app.services.monthly import get_monthly_winner_email_status, run_monthly_winner_email_job
from app.services.serialize import iso
from app.services.settings import get_sarcasm_threshold, set_sarcasm_threshold

router = APIRouter(prefix="/api/admin", tags=["Admin"])


class SettingsBody(BaseModel):
    threshold: int


class ModerationBody(BaseModel):
    type: str
    id: str
    action: str


class DeleteUserBody(BaseModel):
    userId: str


class MonthlyBody(BaseModel):
    action: str


@router.get("/settings")
def get_settings(admin: AdminUser, session: DBSession):
    return {"threshold": get_sarcasm_threshold(session)}


@router.put("/settings")
def put_settings(body: SettingsBody, admin: AdminUser, session: DBSession):
    if not isinstance(body.threshold, int) or body.threshold < 0 or body.threshold > 100:
        raise HTTPException(status_code=400, detail="임계치는 0~100 정수여야 합니다.")
    try:
        set_sarcasm_threshold(session, body.threshold, admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"threshold": body.threshold, "message": "임계치가 저장되었습니다."}


@router.get("/moderation")
def moderation_queue(
    admin: AdminUser,
    session: DBSession,
    status: str = Query(default="PENDING"),
):
    try:
        status_enum = ModerationStatus(status)
    except ValueError:
        status_enum = ModerationStatus.PENDING
    posts = session.exec(
        select(Post).where(Post.moderationStatus == status_enum).order_by(Post.createdAt.desc()).limit(50)
    ).all()
    comments = session.exec(
        select(Comment)
        .where(Comment.moderationStatus == status_enum)
        .order_by(Comment.createdAt.desc())
        .limit(50)
    ).all()
    items = []
    for post in posts:
        author = session.get(User, post.authorId)
        target = session.get(User, post.targetUserId)
        items.append(
            {
                "type": "post",
                "id": post.id,
                "title": post.title,
                "content": post.content,
                "targetName": target.name if target else None,
                "sarcasmScore": post.sarcasmScore,
                "aggression": post.aggression,
                "aiReport": post.aiReport,
                "moderationStatus": post.moderationStatus.value
                if hasattr(post.moderationStatus, "value")
                else post.moderationStatus,
                "createdAt": iso(post.createdAt),
                "author": {
                    "id": author.id if author else "",
                    "displayId": author.displayId if author else "",
                    "email": author.email if author else "",
                    "name": author.name if author else "",
                },
                "postTitle": None,
                "postId": None,
            }
        )
    for comment in comments:
        author = session.get(User, comment.authorId)
        post = session.get(Post, comment.postId)
        items.append(
            {
                "type": "comment",
                "id": comment.id,
                "title": None,
                "content": comment.content,
                "targetName": None,
                "sarcasmScore": comment.sarcasmScore,
                "aggression": comment.aggression,
                "aiReport": comment.aiReport,
                "moderationStatus": comment.moderationStatus.value
                if hasattr(comment.moderationStatus, "value")
                else comment.moderationStatus,
                "createdAt": iso(comment.createdAt),
                "author": {
                    "id": author.id if author else "",
                    "displayId": author.displayId if author else "",
                    "email": author.email if author else "",
                    "name": author.name if author else "",
                },
                "postTitle": post.title if post else None,
                "postId": post.id if post else None,
            }
        )
    items.sort(key=lambda x: x["createdAt"] or "", reverse=True)
    pending_posts = len(
        session.exec(select(Post).where(Post.moderationStatus == ModerationStatus.PENDING)).all()
    )
    pending_comments = len(
        session.exec(select(Comment).where(Comment.moderationStatus == ModerationStatus.PENDING)).all()
    )
    return {"items": items, "pendingCount": pending_posts + pending_comments}


@router.patch("/moderation")
def moderate(body: ModerationBody, admin: AdminUser, session: DBSession):
    if body.type not in ("post", "comment") or body.action not in ("approve", "delete"):
        raise HTTPException(status_code=400, detail="잘못된 요청입니다.")
    if body.action == "delete":
        if body.type == "post":
            row = session.get(Post, body.id)
        else:
            row = session.get(Comment, body.id)
        if row:
            session.delete(row)
            session.commit()
        return {"message": "삭제되었습니다."}
    if body.type == "post":
        row = session.get(Post, body.id)
    else:
        row = session.get(Comment, body.id)
    if not row:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    row.moderationStatus = ModerationStatus.APPROVED
    row.adminReviewedAt = datetime.utcnow()
    row.adminReviewedBy = admin.id
    session.add(row)
    session.commit()
    return {"message": "검토 완료(승인) 처리되었습니다."}


@router.get("/users")
def list_users(admin: AdminUser, session: DBSession):
    users = session.exec(select(User).order_by(User.createdAt.desc())).all()
    payload = []
    for user in users:
        posts = len(session.exec(select(Post).where(Post.authorId == user.id)).all())
        comments = len(session.exec(select(Comment).where(Comment.authorId == user.id)).all())
        payload.append(
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "displayId": user.displayId,
                "role": user.role.value if hasattr(user.role, "value") else user.role,
                "emailVerified": iso(user.emailVerified),
                "createdAt": iso(user.createdAt),
                "_count": {"posts": posts, "comments": comments},
            }
        )
    return {"users": payload, "total": len(payload)}


@router.delete("/users")
def delete_user(body: DeleteUserBody, admin: AdminUser, session: DBSession):
    if not body.userId:
        raise HTTPException(status_code=400, detail="삭제할 회원 ID가 필요합니다.")
    if body.userId == admin.id:
        raise HTTPException(
            status_code=400,
            detail="본인 계정은 이 화면에서 삭제할 수 없습니다. 프로필의 회원 탈퇴를 이용해 주세요.",
        )
    target = session.get(User, body.userId)
    if not target:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    if target.role == UserRole.ADMIN:
        admin_count = len(session.exec(select(User).where(User.role == UserRole.ADMIN)).all())
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="마지막 관리자 계정은 삭제할 수 없습니다.")
    session.delete(target)
    session.commit()
    return {"message": f"{target.name}({target.email}) 계정이 삭제되었습니다."}


@router.get("/monthly-winner")
def monthly_status(admin: AdminUser, session: DBSession):
    return get_monthly_winner_email_status(session)


@router.post("/monthly-winner")
def monthly_send(body: MonthlyBody, admin: AdminUser, session: DBSession):
    if body.action not in ("test", "send"):
        raise HTTPException(status_code=400, detail="action은 test 또는 send 여야 합니다.")
    return run_monthly_winner_email_job(
        session,
        force=body.action == "send",
        test_email=admin.email if body.action == "test" else None,
        triggered_by="admin",
    )
