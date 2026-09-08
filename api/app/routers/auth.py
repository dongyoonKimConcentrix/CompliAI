from datetime import datetime

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlmodel import select

from app.config import get_settings
from fastapi import APIRouter, Request
from sqlmodel import select

from app.deps import DBSession
from app.models import User
from app.security import TOKEN_COOKIE, decode_access_token
from app.services.serialize import session_user
from app.ids import generate_display_id, new_id, random_hex_token
from app.mail import dispatch_password_reset_email, dispatch_verification_email
from app.models import User, UserRole
from app.security import (
    clear_token_cookie,
    create_access_token,
    hash_password,
    set_token_cookie,
    verify_password,
)
from app.services.domain import (
    ALLOWED_EMAIL_ERROR,
    is_allowed_company_email,
    is_duplicate_name,
    is_password_reset_expired,
    is_verification_expired,
    normalize_name,
    password_reset_expiry,
)
from app.services.serialize import session_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class RegisterBody(BaseModel):
    email: str
    password: str
    name: str


class LoginBody(BaseModel):
    email: str
    password: str


class VerifyBody(BaseModel):
    token: str | None = None


class ResendBody(BaseModel):
    email: str
    password: str


class ForgotBody(BaseModel):
    email: str


class ResetBody(BaseModel):
    token: str
    password: str = Field(min_length=6)


@router.post("/register")
def register(body: RegisterBody, session: DBSession):
    if not body.email or not body.password or not body.name:
        raise HTTPException(status_code=400, detail="모든 필드를 입력해 주세요.")
    normalized_name = normalize_name(body.name)
    if len(normalized_name) < 2:
        raise HTTPException(status_code=400, detail="이름은 2자 이상 입력해 주세요.")
    email = body.email.strip().lower()
    if not is_allowed_company_email(email):
        raise HTTPException(status_code=400, detail=ALLOWED_EMAIL_ERROR)
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다.")
    users = session.exec(select(User)).all()
    if is_duplicate_name(normalized_name, list(users)):
        raise HTTPException(
            status_code=409, detail="동일한 이름으로 등록된 회원이 있습니다. 이름을 확인해 주세요."
        )

    display_id = None
    for _ in range(10):
        candidate = generate_display_id()
        if not session.exec(select(User).where(User.displayId == candidate)).first():
            display_id = candidate
            break
    if not display_id:
        raise HTTPException(status_code=500, detail="익명 ID 생성에 실패했습니다.")

    token = random_hex_token()
    user = User(
        id=new_id(),
        email=email,
        passwordHash=hash_password(body.password),
        name=normalized_name,
        displayId=display_id,
        role=UserRole.USER,
        verificationToken=token,
        updatedAt=datetime.utcnow(),
    )
    session.add(user)
    session.commit()
    try:
        mail_result = dispatch_verification_email(email, normalized_name, token)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return mail_result


@router.post("/login")
def login(body: LoginBody, response: Response, session: DBSession):
    email = body.email.strip().lower()
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not verify_password(body.password, user.passwordHash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if not user.emailVerified:
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
    )
    set_token_cookie(response, token)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": session_user(user),
    }


@router.post("/logout")
def logout(response: Response):
    clear_token_cookie(response)
    return {"message": "로그아웃되었습니다."}


@router.get("/session")
def session_info(request: Request, session: DBSession):
    token = request.cookies.get(TOKEN_COOKIE)
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth[7:]
    if not token:
        return {"user": None}
    try:
        payload = decode_access_token(token)
        user = session.exec(select(User).where(User.id == payload.get("sub"))).first()
    except Exception:
        return {"user": None}
    if not user:
        return {"user": None}
    return {"user": session_user(user)}


@router.get("/verify")
def verify_redirect(token: str | None = None):
    settings = get_settings()
    if not token:
        return RedirectResponse(f"{settings.app_url}/login?error=invalid_token")
    from urllib.parse import quote

    return RedirectResponse(f"{settings.app_url}/verify-email?token={quote(token)}")


@router.post("/verify")
def verify(body: VerifyBody, session: DBSession):
    token = (body.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="invalid_token")
    user = session.exec(select(User).where(User.verificationToken == token)).first()
    if not user:
        raise HTTPException(status_code=400, detail="invalid_token")
    if user.emailVerified:
        raise HTTPException(status_code=400, detail="already_verified")
    if is_verification_expired(user.updatedAt):
        raise HTTPException(status_code=400, detail="expired_token")
    user.emailVerified = datetime.utcnow()
    user.verificationToken = None
    session.add(user)
    session.commit()
    return {"ok": True}


@router.post("/resend-verification")
def resend(body: ResendBody, session: DBSession):
    email = body.email.strip().lower()
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not verify_password(body.password, user.passwordHash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if user.emailVerified:
        raise HTTPException(status_code=400, detail="이미 인증된 계정입니다. 로그인해 주세요.")
    token = random_hex_token()
    user.verificationToken = token
    user.updatedAt = datetime.utcnow()
    session.add(user)
    session.commit()
    return dispatch_verification_email(user.email, user.name, token)


@router.post("/forgot-password")
def forgot(body: ForgotBody, session: DBSession):
    generic = "등록된 이메일이라면 비밀번호 재설정 링크를 발송했습니다. 메일함을 확인해 주세요."
    email = body.email.strip().lower()
    if not is_allowed_company_email(email):
        raise HTTPException(status_code=400, detail=ALLOWED_EMAIL_ERROR)
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        return {"message": generic}
    token = random_hex_token()
    user.passwordResetToken = token
    user.passwordResetTokenExpiresAt = password_reset_expiry()
    session.add(user)
    session.commit()
    result = dispatch_password_reset_email(user.email, user.name, token)
    return {
        "message": result.get("message") or generic,
        "emailSent": result.get("sent"),
        "resetUrl": result.get("resetUrl"),
    }


@router.post("/reset-password")
def reset_password(body: ResetBody, session: DBSession):
    user = session.exec(select(User).where(User.passwordResetToken == body.token)).first()
    if not user:
        raise HTTPException(status_code=400, detail="invalid_token")
    if is_password_reset_expired(user.passwordResetTokenExpiresAt):
        raise HTTPException(status_code=400, detail="expired_token")
    user.passwordHash = hash_password(body.password)
    user.passwordResetToken = None
    user.passwordResetTokenExpiresAt = None
    session.add(user)
    session.commit()
    return {"message": "비밀번호가 변경되었습니다."}
