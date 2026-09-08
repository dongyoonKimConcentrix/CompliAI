from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.database import get_session
from app.models import User, UserRole
from app.security import TOKEN_COOKIE, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def _extract_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str | None:
    if credentials and credentials.credentials:
        return credentials.credentials
    return request.cookies.get(TOKEN_COOKIE)


def get_current_user(
    token: str | None = Depends(_extract_token),
    session: Session = Depends(get_session),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="인증이 만료되었습니다.") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.") from None

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")

    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    return user


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    return user


def require_cron_secret(
    authorization: Annotated[str | None, Header()] = None,
    x_cron_secret: Annotated[str | None, Header()] = None,
) -> None:
    from app.config import get_settings

    secret = get_settings().cron_secret
    if not secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if authorization == f"Bearer {secret}":
        return
    if x_cron_secret == secret:
        return
    raise HTTPException(status_code=401, detail="Unauthorized")


AuthUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(get_admin_user)]
DBSession = Annotated[Session, Depends(get_session)]
