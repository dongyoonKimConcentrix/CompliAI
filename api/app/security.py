from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Response

from app.config import get_settings

TOKEN_COOKIE = "compliai_token"
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(*, user_id: str, email: str, name: str, role: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])


def set_token_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=TOKEN_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.app_url.startswith("https"),
        max_age=settings.jwt_expire_days * 24 * 3600,
        path="/",
    )


def clear_token_cookie(response: Response) -> None:
    response.delete_cookie(TOKEN_COOKIE, path="/")
