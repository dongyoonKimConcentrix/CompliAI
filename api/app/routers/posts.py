from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlmodel import select

from app.deps import AuthUser, DBSession
from app.ids import content_id_from_str, new_id
from app.models import Comment, Like, ModerationStatus, Post, Report, User
from app.schemas import AnalyzeRequest
from app.services.analyzer import analyze_text
from app.services.domain import find_valid_praise_target, needs_moderation_review
from app.services.serialize import serialize_comment, serialize_post_list_item
from app.services.settings import get_sarcasm_threshold

router = APIRouter(prefix="/api/posts", tags=["Posts"])
PAGE_SIZE = 10


class CreatePostBody(BaseModel):
    title: str
    content: str
    targetUserId: str
    fileUrl: str | None = None


class UpdatePostBody(BaseModel):
    title: str
    content: str
    targetUserId: str
    fileUrl: str | None = None


class CreateCommentBody(BaseModel):
    content: str
    parentId: str | None = None


def _users_by_ids(session, ids: set[str]) -> dict[str, User]:
    if not ids:
        return {}
    users = session.exec(select(User).where(User.id.in_(ids))).all()  # type: ignore[attr-defined]
    return {user.id: user for user in users}


@router.get("")
def list_posts(
    user: AuthUser,
    session: DBSession,
    cursor: str | None = None,
    q: str | None = Query(default=None),
):
    query = (q or "").strip()
    stmt = select(Post)
    if query:
        stmt = stmt.join(User, Post.targetUserId == User.id).where(
            or_(
                Post.title.ilike(f"%{query}%"),
                Post.content.ilike(f"%{query}%"),
                User.name.ilike(f"%{query}%"),
            )
        )
    if cursor:
        cursor_post = session.get(Post, cursor)
        if cursor_post:
            stmt = stmt.where(Post.createdAt < cursor_post.createdAt)
    posts = list(session.exec(stmt.order_by(Post.createdAt.desc()).limit(PAGE_SIZE + 1)).all())
    next_cursor = None
    if len(posts) > PAGE_SIZE:
        next_item = posts.pop()
        next_cursor = next_item.id
    ids = {p.authorId for p in posts} | {p.targetUserId for p in posts}
    users = _users_by_ids(session, ids)
    return {
        "posts": [
            serialize_post_list_item(session, post, users.get(post.authorId), users.get(post.targetUserId))
            for post in posts
        ],
        "nextCursor": next_cursor,
    }


@router.post("")
async def create_post(body: CreatePostBody, user: AuthUser, session: DBSession):
    if not body.title or not body.content or not body.targetUserId:
        raise HTTPException(status_code=400, detail="필수 항목을 입력해 주세요.")
    try:
        target = find_valid_praise_target(session, body.targetUserId, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        analysis = await analyze_text(
            AnalyzeRequest(text=f"{body.title}\n{body.content}", content_type="post"),
            session,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="AI 분석 서버에 연결할 수 없습니다. FastAPI(api) 서버가 실행 중인지 확인해 주세요.",
        ) from exc
    threshold = get_sarcasm_threshold(session)
    status = (
        ModerationStatus.PENDING
        if needs_moderation_review(analysis.sarcasm_score, analysis.aggression, threshold)
        else ModerationStatus.APPROVED
    )
    post = Post(
        id=new_id(),
        title=body.title,
        content=body.content,
        targetUserId=target.id,
        fileUrl=body.fileUrl or None,
        authorId=user.id,
        sarcasmScore=analysis.sarcasm_score,
        aggression=analysis.aggression,
        isBlinded=False,
        moderationStatus=status,
        aiReport=analysis.ai_report,
    )
    session.add(post)
    session.commit()
    session.refresh(post)
    return {"post": post.model_dump(), "analysis": analysis.model_dump()}


@router.get("/{post_id}")
def get_post(post_id: str, user: AuthUser, session: DBSession):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    author = session.get(User, post.authorId)
    target = session.get(User, post.targetUserId)
    comments = session.exec(
        select(Comment).where(Comment.postId == post_id).order_by(Comment.createdAt.asc())
    ).all()
    authors = _users_by_ids(session, {c.authorId for c in comments} | {post.authorId})
    item = serialize_post_list_item(session, post, author, target)
    item["author"] = {
        "id": author.id if author else "",
        "displayId": author.displayId if author else "",
        "email": author.email if author else "",
    }
    item["comments"] = [serialize_comment(c, authors.get(c.authorId)) for c in comments]
    item["_count"] = {
        "likes": item["_count"]["likes"],
        "reports": item["_count"]["reports"],
    }
    return {"post": item}


@router.put("/{post_id}")
async def update_post(post_id: str, body: UpdatePostBody, user: AuthUser, session: DBSession):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if post.authorId != user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
    if not body.targetUserId:
        raise HTTPException(status_code=400, detail="칭찬 대상을 선택해 주세요.")
    try:
        target = find_valid_praise_target(session, body.targetUserId, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    analysis = await analyze_text(
        AnalyzeRequest(
            text=f"{body.title}\n{body.content}",
            content_type="post",
            content_id=content_id_from_str(post_id),
        ),
        session,
    )
    threshold = get_sarcasm_threshold(session)
    status = (
        ModerationStatus.PENDING
        if needs_moderation_review(analysis.sarcasm_score, analysis.aggression, threshold)
        else ModerationStatus.APPROVED
    )
    post.title = body.title
    post.content = body.content
    post.targetUserId = target.id
    post.fileUrl = body.fileUrl if body.fileUrl is not None else post.fileUrl
    post.sarcasmScore = analysis.sarcasm_score
    post.aggression = analysis.aggression
    post.isBlinded = False
    post.moderationStatus = status
    if status != ModerationStatus.APPROVED:
        post.adminReviewedAt = None
        post.adminReviewedBy = None
    post.aiReport = analysis.ai_report
    session.add(post)
    session.commit()
    session.refresh(post)
    return {"post": post.model_dump(), "analysis": analysis.model_dump()}


@router.delete("/{post_id}")
def delete_post(post_id: str, user: AuthUser, session: DBSession):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    is_admin = (user.role.value if hasattr(user.role, "value") else user.role) == "ADMIN"
    if post.authorId != user.id and not is_admin:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    session.delete(post)
    session.commit()
    return {"message": "삭제되었습니다."}


@router.get("/{post_id}/comments")
def list_comments(post_id: str, user: AuthUser, session: DBSession):
    comments = session.exec(
        select(Comment).where(Comment.postId == post_id).order_by(Comment.createdAt.asc())
    ).all()
    authors = _users_by_ids(session, {c.authorId for c in comments})
    return {"comments": [serialize_comment(c, authors.get(c.authorId)) for c in comments]}


@router.post("/{post_id}/comments")
async def create_comment(post_id: str, body: CreateCommentBody, user: AuthUser, session: DBSession):
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="댓글 내용을 입력해 주세요.")
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    parent_id = None
    if body.parentId:
        parent = session.get(Comment, body.parentId)
        if not parent or parent.postId != post_id:
            raise HTTPException(status_code=400, detail="부모 댓글을 찾을 수 없습니다.")
        parent_id = parent.parentId or parent.id
    try:
        analysis = await analyze_text(
            AnalyzeRequest(text=body.content, content_type="comment"), session
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail="AI 분석 서버에 연결할 수 없습니다.") from exc
    threshold = get_sarcasm_threshold(session)
    status = (
        ModerationStatus.PENDING
        if needs_moderation_review(analysis.sarcasm_score, analysis.aggression, threshold)
        else ModerationStatus.APPROVED
    )
    comment = Comment(
        id=new_id(),
        content=body.content,
        postId=post_id,
        parentId=parent_id,
        authorId=user.id,
        sarcasmScore=analysis.sarcasm_score,
        aggression=analysis.aggression,
        isBlinded=False,
        moderationStatus=status,
        aiReport=analysis.ai_report,
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    author = session.get(User, user.id)
    return {"comment": serialize_comment(comment, author), "analysis": analysis.model_dump()}


@router.get("/{post_id}/like")
def get_like(post_id: str, user: AuthUser, session: DBSession):
    like = session.exec(
        select(Like).where(Like.postId == post_id, Like.userId == user.id)
    ).first()
    count = session.exec(select(Like).where(Like.postId == post_id)).all()
    return {"liked": bool(like), "count": len(count)}


@router.post("/{post_id}/like")
def toggle_like(post_id: str, user: AuthUser, session: DBSession):
    existing = session.exec(
        select(Like).where(Like.postId == post_id, Like.userId == user.id)
    ).first()
    if existing:
        session.delete(existing)
        session.commit()
        count = len(session.exec(select(Like).where(Like.postId == post_id)).all())
        return {"liked": False, "count": count}
    session.add(Like(id=new_id(), postId=post_id, userId=user.id))
    session.commit()
    count = len(session.exec(select(Like).where(Like.postId == post_id)).all())
    return {"liked": True, "count": count}


@router.get("/{post_id}/report")
def get_report(post_id: str, user: AuthUser, session: DBSession):
    report = session.exec(
        select(Report).where(Report.postId == post_id, Report.userId == user.id)
    ).first()
    count = len(session.exec(select(Report).where(Report.postId == post_id)).all())
    return {"reported": bool(report), "count": count}


@router.post("/{post_id}/report")
def create_report(post_id: str, user: AuthUser, session: DBSession):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if post.authorId == user.id:
        raise HTTPException(status_code=400, detail="본인 게시글은 신고할 수 없습니다.")
    existing = session.exec(
        select(Report).where(Report.postId == post_id, Report.userId == user.id)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 신고한 게시글입니다.")
    session.add(Report(id=new_id(), postId=post_id, userId=user.id))
    session.commit()
    count = len(session.exec(select(Report).where(Report.postId == post_id)).all())
    return {"reported": True, "count": count}
