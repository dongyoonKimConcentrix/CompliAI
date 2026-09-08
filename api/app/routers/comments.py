from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from app.deps import AuthUser, DBSession
from app.models import Comment, User
from app.services.serialize import serialize_comment

router = APIRouter(prefix="/api/comments", tags=["Comments"])


class UpdateCommentBody(BaseModel):
    content: str


@router.delete("/{comment_id}")
def delete_comment(comment_id: str, user: AuthUser, session: DBSession):
    comment = session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.authorId != user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    session.delete(comment)
    session.commit()
    return {"message": "삭제되었습니다."}


@router.put("/{comment_id}")
def update_comment(comment_id: str, body: UpdateCommentBody, user: AuthUser, session: DBSession):
    comment = session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.authorId != user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
    comment.content = body.content
    session.add(comment)
    session.commit()
    session.refresh(comment)
    author = session.get(User, comment.authorId)
    return {"comment": serialize_comment(comment, author)}
