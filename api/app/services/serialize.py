from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Comment, Like, Post, Report, User
from app.services.domain import iso


def user_public(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "displayId": user.displayId,
        "profileImage": user.profileImage,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "createdAt": iso(user.createdAt),
    }


def session_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "image": user.profileImage,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
    }


def _count(session: Session, model, **filters) -> int:
    stmt = select(func.count()).select_from(model)
    for key, value in filters.items():
        stmt = stmt.where(getattr(model, key) == value)
    return session.exec(stmt).one()


def serialize_post_list_item(session: Session, post: Post, author: User | None, target: User | None) -> dict:
    return {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "targetUserId": post.targetUserId,
        "fileUrl": post.fileUrl,
        "isBlinded": post.isBlinded,
        "sarcasmScore": post.sarcasmScore,
        "aggression": post.aggression,
        "aiReport": post.aiReport,
        "moderationStatus": post.moderationStatus.value
        if hasattr(post.moderationStatus, "value")
        else post.moderationStatus,
        "authorId": post.authorId,
        "createdAt": iso(post.createdAt),
        "updatedAt": iso(post.updatedAt),
        "author": {
            "displayId": author.displayId if author else "",
            "email": author.email if author else "",
        },
        "target": {"id": target.id if target else "", "name": target.name if target else ""},
        "_count": {
            "likes": _count(session, Like, postId=post.id),
            "comments": _count(session, Comment, postId=post.id),
            "reports": _count(session, Report, postId=post.id),
        },
    }


def serialize_comment(comment: Comment, author: User | None) -> dict:
    return {
        "id": comment.id,
        "content": comment.content,
        "isBlinded": comment.isBlinded,
        "sarcasmScore": comment.sarcasmScore,
        "authorId": comment.authorId,
        "parentId": comment.parentId,
        "createdAt": iso(comment.createdAt),
        "author": {
            "id": author.id if author else "",
            "displayId": author.displayId if author else "",
            "email": author.email if author else "",
        },
    }
