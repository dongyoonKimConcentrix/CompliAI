from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Like, User, UserRole

KST = ZoneInfo("Asia/Seoul")
ALLOWED_EMAIL_DOMAIN = "@concentrix.com"
ALLOWED_EMAIL_ERROR = "Concentrix 사내 이메일(@concentrix.com)만 가입할 수 있습니다."
PRAISE_POST_POINTS = 10
PRAISE_LIKE_POINTS = 1
SARCASM_THRESHOLD = 70
REPORT_THRESHOLD = 3
TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000
RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.isoformat() + "Z"
    return dt.isoformat()


def normalize_name(value: str) -> str:
    return value.strip().replace(" ", "").replace("\t", "")


def names_match(registered_name: str, candidate_name: str) -> bool:
    a = normalize_name(registered_name)
    b = normalize_name(candidate_name)
    if not a or not b:
        return False
    if a == b:
        return True
    return a in b or b in a


def is_duplicate_name(name: str, users: list[User]) -> bool:
    normalized = normalize_name(name)
    if not normalized:
        return False
    return any(names_match(user.name, normalized) for user in users)


def is_allowed_company_email(email: str) -> bool:
    return email.strip().lower().endswith(ALLOWED_EMAIL_DOMAIN)


def is_positive_praise(sarcasm_score: int, aggression: bool) -> bool:
    return sarcasm_score < SARCASM_THRESHOLD and not aggression


def get_month_range_kst(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1, tzinfo=KST)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=KST)
    else:
        end = datetime(year, month + 1, 1, tzinfo=KST)
    return start.astimezone(timezone.utc).replace(tzinfo=None), end.astimezone(timezone.utc).replace(
        tzinfo=None
    )


def get_kst_now() -> tuple[int, int]:
    now = datetime.now(KST)
    return now.year, now.month


def calculate_praise_score(praise_count: int, like_count: int) -> int:
    return praise_count * PRAISE_POST_POINTS + like_count * PRAISE_LIKE_POINTS


def build_leaderboard(posts: list[dict], users: list[User]) -> list[dict]:
    user_map = {user.id: user for user in users}
    totals: dict[str, dict] = {}
    for post in posts:
        if not is_positive_praise(post["sarcasmScore"], post["aggression"]):
            continue
        if post["authorId"] == post["targetUserId"]:
            continue
        recipient = user_map.get(post["targetUserId"])
        if not recipient:
            continue
        current = totals.get(recipient.id) or {
            "userId": recipient.id,
            "name": recipient.name,
            "praiseCount": 0,
            "likeCount": 0,
        }
        current["praiseCount"] += 1
        current["likeCount"] += post["likeCount"]
        totals[recipient.id] = current

    sorted_rows = sorted(
        (
            {**entry, "score": calculate_praise_score(entry["praiseCount"], entry["likeCount"])}
            for entry in totals.values()
        ),
        key=lambda e: (-e["score"], -e["praiseCount"], e["name"]),
    )
    return [
        {
            "rank": index + 1,
            "userId": entry["userId"],
            "name": entry["name"],
            "praiseCount": entry["praiseCount"],
            "likeCount": entry["likeCount"],
            "score": entry["score"],
        }
        for index, entry in enumerate(sorted_rows)
    ]


def find_valid_praise_target(session: Session, target_user_id: str, author_id: str) -> User:
    if target_user_id == author_id:
        raise ValueError("본인에게는 칭찬할 수 없습니다.")
    target = session.exec(
        select(User).where(
            User.id == target_user_id,
            User.role == UserRole.USER,
            User.emailVerified != None,  # noqa: E711
            User.name != "",
        )
    ).first()
    if not target:
        raise ValueError("유효하지 않은 칭찬 대상입니다.")
    return target


def needs_moderation_review(sarcasm_score: int, aggression: bool, threshold: int) -> bool:
    return sarcasm_score >= threshold or aggression


def is_verification_expired(issued_at: datetime | None) -> bool:
    if issued_at is None:
        return True
    issued = issued_at.replace(tzinfo=timezone.utc) if issued_at.tzinfo is None else issued_at
    return (datetime.now(timezone.utc) - issued).total_seconds() * 1000 > TOKEN_EXPIRY_MS


def password_reset_expiry() -> datetime:
    return datetime.utcnow() + timedelta(milliseconds=RESET_TOKEN_EXPIRY_MS)


def is_password_reset_expired(expires_at: datetime | None) -> bool:
    if expires_at is None:
        return True
    naive = expires_at.replace(tzinfo=None) if expires_at.tzinfo else expires_at
    return datetime.utcnow() > naive


def like_count(session: Session, post_id: str) -> int:
    return session.exec(select(func.count()).select_from(Like).where(Like.postId == post_id)).one()
