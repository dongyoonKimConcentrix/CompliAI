from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import select

from app.deps import AuthUser, DBSession
from app.models import Comment, Like, Post, User, UserRole
from app.security import clear_token_cookie, verify_password
from app.services.serialize import iso, serialize_post_list_item

router = APIRouter(tags=["Profile"])


class UpdateProfileBody(BaseModel):
    profileImage: str | None = None


class DeleteAccountBody(BaseModel):
    password: str


@router.get("/api/profile")
def get_profile(user: AuthUser, session: DBSession):
    posts = session.exec(select(func.count()).select_from(Post).where(Post.authorId == user.id)).one()
    comments = session.exec(
        select(func.count()).select_from(Comment).where(Comment.authorId == user.id)
    ).one()
    likes = session.exec(select(func.count()).select_from(Like).where(Like.userId == user.id)).one()
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "displayId": user.displayId,
            "profileImage": user.profileImage,
            "createdAt": iso(user.createdAt),
            "_count": {"posts": posts, "comments": comments, "likes": likes},
        }
    }


@router.put("/api/profile")
def update_profile(body: UpdateProfileBody, user: AuthUser, session: DBSession):
    if body.profileImage is not None:
        user.profileImage = body.profileImage
        session.add(user)
        session.commit()
        session.refresh(user)
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "displayId": user.displayId,
            "profileImage": user.profileImage,
        }
    }


@router.delete("/api/profile")
def delete_account(body: DeleteAccountBody, user: AuthUser, session: DBSession, response: Response):
    if not body.password:
        raise HTTPException(status_code=400, detail="비밀번호를 입력해 주세요.")
    if not verify_password(body.password, user.passwordHash):
        raise HTTPException(status_code=401, detail="비밀번호가 일치하지 않습니다.")
    if user.role == UserRole.ADMIN:
        admin_count = len(session.exec(select(User).where(User.role == UserRole.ADMIN)).all())
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="마지막 관리자 계정은 탈퇴할 수 없습니다.")
    session.delete(user)
    session.commit()
    clear_token_cookie(response)
    return {"message": "회원 탈퇴가 완료되었습니다."}


@router.get("/api/mypage")
def mypage(user: AuthUser, session: DBSession):
    posts = session.exec(
        select(Post).where(Post.authorId == user.id).order_by(Post.createdAt.desc()).limit(20)
    ).all()
    comments = session.exec(
        select(Comment).where(Comment.authorId == user.id).order_by(Comment.createdAt.desc()).limit(20)
    ).all()
    result_posts = []
    for post in posts:
        target = session.get(User, post.targetUserId)
        item = serialize_post_list_item(session, post, user, target)
        item["_count"] = {
            "likes": item["_count"]["likes"],
            "comments": item["_count"]["comments"],
        }
        result_posts.append(item)
    result_comments = []
    for comment in comments:
        post = session.get(Post, comment.postId)
        result_comments.append(
            {
                "id": comment.id,
                "content": comment.content,
                "createdAt": iso(comment.createdAt),
                "post": {"id": post.id if post else "", "title": post.title if post else ""},
            }
        )
    return {"posts": result_posts, "comments": result_comments}
