import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import get_settings


def is_smtp_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def _send(to: str, subject: str, text: str, html: str) -> None:
    settings = get_settings()
    if not is_smtp_configured():
        raise RuntimeError("SMTP 설정이 없습니다.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f'"CompliAI" <{settings.email_from or settings.smtp_user}>'
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    if settings.smtp_secure:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(msg["From"], [to], msg.as_string())
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(msg["From"], [to], msg.as_string())


def send_verification_email(to: str, name: str, verify_url: str) -> None:
    text = (
        f"{name}님, CompliAI 회원가입을 환영합니다.\n\n"
        "아래 링크를 클릭해 이메일 인증을 완료해 주세요.\n"
        f"{verify_url}\n\n"
        "링크는 24시간 동안 유효합니다.\n"
        "본인이 요청하지 않았다면 이 메일을 무시해 주세요."
    )
    html = f"""
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #6366f1;">CompliAI 이메일 인증</h2>
        <p>{name}님, 회원가입을 환영합니다.</p>
        <p>아래 버튼을 클릭해 이메일 인증을 완료해 주세요.</p>
        <p style="margin: 32px 0;">
          <a href="{verify_url}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
            이메일 인증하기
          </a>
        </p>
        <p style="color:#666;font-size:14px;word-break:break-all;">{verify_url}</p>
        <p style="color:#999;font-size:12px;">링크는 24시간 동안 유효합니다.</p>
      </div>
    """
    _send(to, "[CompliAI] 이메일 인증을 완료해 주세요", text, html)


def send_password_reset_email(to: str, name: str, reset_url: str) -> None:
    text = (
        f"{name}님, 안녕하세요.\n\n"
        "아래 링크를 클릭해 비밀번호를 재설정해 주세요.\n"
        f"{reset_url}\n\n"
        "링크는 1시간 동안 유효합니다."
    )
    html = f"""
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #6366f1;">CompliAI 비밀번호 재설정</h2>
        <p>{name}님, 안녕하세요.</p>
        <p style="margin: 32px 0;">
          <a href="{reset_url}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
            비밀번호 재설정하기
          </a>
        </p>
        <p style="color:#666;font-size:14px;word-break:break-all;">{reset_url}</p>
      </div>
    """
    _send(to, "[CompliAI] 비밀번호 재설정", text, html)


def send_monthly_winner_announcement(
    *,
    to: str,
    name: str,
    period_label: str,
    winners: list[dict],
    rankings_url: str,
    is_test: bool = False,
) -> None:
    test_prefix = "[테스트] " if is_test else ""
    if winners:
        winner_text = "\n".join(
            f"{w['name']} ({w['score']}점 · 칭찬 {w['praiseCount']}건 · 좋아요 {w['likeCount']})"
            for w in winners
        )
        winner_html = "<ul>" + "".join(
            f"<li><strong>{w['name']}</strong> — {w['score']}점 (칭찬 {w['praiseCount']}건, 좋아요 {w['likeCount']})</li>"
            for w in winners
        ) + "</ul>"
        subject = f"{test_prefix}[CompliAI] {period_label} 칭찬왕 발표"
        intro = f"{period_label} CompliAI 칭찬왕을 발표합니다!"
    else:
        winner_text = "해당 월 칭찬왕이 없습니다."
        winner_html = f"<p style=\"color:#666;\">{winner_text}</p>"
        subject = f"{test_prefix}[CompliAI] {period_label} 칭찬왕 메일 테스트"
        intro = f"{period_label} 칭찬왕 메일 발송 테스트입니다."

    text = f"{name}님, 안녕하세요.\n\n{intro}\n\n{winner_text}\n\n전체 랭킹 보기: {rankings_url}"
    html = f"""
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2>{test_prefix}{period_label} 칭찬왕</h2>
        <p>{name}님, 안녕하세요.</p>
        <p>{intro}</p>
        {winner_html}
        <p style="margin: 32px 0;">
          <a href="{rankings_url}" style="background:#171717;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
            랭킹 보러 가기
          </a>
        </p>
      </div>
    """
    _send(to, subject, text, html)


def dispatch_verification_email(email: str, name: str, token: str) -> dict:
    from app.config import get_settings
    import os

    settings = get_settings()
    verify_url = f"{settings.app_url}/verify-email?token={token}"
    if is_smtp_configured():
        try:
            send_verification_email(email, name, verify_url)
        except Exception as exc:
            print("[CompliAI] 인증 메일 발송 실패:", email, exc)
        return {
            "sent": True,
            "message": "입력하신 이메일로 인증 링크를 발송 중입니다. 수신까지 1~2분 걸릴 수 있습니다.",
        }
    if os.getenv("NODE_ENV") == "development" or "localhost" in settings.app_url:
        print("[CompliAI] 이메일 인증 링크:", verify_url)
        return {
            "sent": False,
            "verifyUrl": verify_url,
            "message": "SMTP가 설정되지 않아 개발 모드로 동작합니다. 터미널 또는 아래 링크로 인증해 주세요.",
        }
    raise RuntimeError("이메일 발송 설정이 없습니다. 관리자에게 문의해 주세요.")


def dispatch_password_reset_email(email: str, name: str, token: str) -> dict:
    from app.config import get_settings
    import os

    settings = get_settings()
    reset_url = f"{settings.app_url}/reset-password?token={token}"
    if is_smtp_configured():
        try:
            send_password_reset_email(email, name, reset_url)
        except Exception as exc:
            print("[CompliAI] 비밀번호 재설정 메일 발송 실패:", email, exc)
        return {
            "sent": True,
            "message": "입력하신 이메일로 비밀번호 재설정 링크를 발송 중입니다. 수신까지 1~2분 걸릴 수 있습니다.",
        }
    if os.getenv("NODE_ENV") == "development" or "localhost" in settings.app_url:
        print("[CompliAI] 비밀번호 재설정 링크:", reset_url)
        return {
            "sent": False,
            "resetUrl": reset_url,
            "message": "SMTP가 설정되지 않아 개발 모드로 동작합니다. 터미널 또는 아래 링크로 재설정해 주세요.",
        }
    raise RuntimeError("이메일 발송 설정이 없습니다. 관리자에게 문의해 주세요.")
