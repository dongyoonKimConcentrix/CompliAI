from datetime import datetime
from time import sleep

from sqlmodel import Session, select

from app.config import get_settings
from app.ids import new_id
from app.mail import is_smtp_configured, send_monthly_winner_announcement
from app.models import MonthlyAnnouncementLog, User
from app.services.domain import get_kst_now
from app.services.rankings import get_monthly_ranking


def get_previous_month_kst() -> tuple[int, int]:
    year, month = get_kst_now()
    if month == 1:
        return year - 1, 12
    return year, month - 1


def get_winners(leaders: list[dict]) -> list[dict]:
    if not leaders:
        return []
    top = leaders[0]["score"]
    return [entry for entry in leaders if entry["score"] == top]


def _log_for(session: Session, year: int, month: int) -> MonthlyAnnouncementLog | None:
    return session.exec(
        select(MonthlyAnnouncementLog).where(
            MonthlyAnnouncementLog.year == year, MonthlyAnnouncementLog.month == month
        )
    ).first()


def run_monthly_winner_email_job(
    session: Session,
    *,
    force: bool = False,
    test_email: str | None = None,
    triggered_by: str = "cron",
) -> dict:
    if not is_smtp_configured():
        return {"ok": False, "skipped": True, "reason": "SMTP 설정이 없습니다."}

    year, month = get_previous_month_kst()
    ranking = get_monthly_ranking(session, year, month)
    winners = get_winners(ranking["leaders"])
    settings = get_settings()
    rankings_url = f"{settings.app_url}/rankings"

    if not winners:
        if test_email:
            send_monthly_winner_announcement(
                to=test_email,
                name="테스트",
                period_label=ranking["period"]["label"],
                winners=[],
                rankings_url=rankings_url,
                is_test=True,
            )
            return {
                "ok": True,
                "skipped": False,
                "period": ranking["period"],
                "winners": [],
                "recipientCount": 1,
            }
        existing = _log_for(session, year, month)
        if existing and not force:
            return {
                "ok": True,
                "skipped": True,
                "reason": "이미 처리되었습니다.",
                "period": ranking["period"],
                "winners": [],
                "recipientCount": 0,
            }
        _upsert_log(session, year, month, 0, "", triggered_by)
        return {
            "ok": True,
            "skipped": True,
            "reason": "해당 월 칭찬왕이 없어 메일을 발송하지 않았습니다.",
            "period": ranking["period"],
            "winners": [],
            "recipientCount": 0,
        }

    if not test_email and not force:
        existing = _log_for(session, year, month)
        if existing and existing.recipientCount > 0:
            return {
                "ok": True,
                "skipped": True,
                "reason": "이미 발송되었습니다.",
                "period": ranking["period"],
                "winners": winners,
                "recipientCount": existing.recipientCount,
            }

    if test_email:
        recipients = [{"email": test_email, "name": "테스트"}]
    else:
        recipients = [
            {"email": user.email, "name": user.name}
            for user in session.exec(select(User).where(User.emailVerified != None)).all()  # noqa: E711
        ]

    if not recipients:
        return {
            "ok": False,
            "skipped": True,
            "reason": "발송 대상 회원이 없습니다.",
            "period": ranking["period"],
            "winners": winners,
            "recipientCount": 0,
        }

    for recipient in recipients:
        send_monthly_winner_announcement(
            to=recipient["email"],
            name=recipient["name"],
            period_label=ranking["period"]["label"],
            winners=winners,
            rankings_url=rankings_url,
            is_test=bool(test_email),
        )
        sleep(0.2)

    if not test_email:
        _upsert_log(
            session,
            year,
            month,
            len(recipients),
            ", ".join(w["name"] for w in winners),
            triggered_by,
        )

    return {
        "ok": True,
        "skipped": False,
        "period": ranking["period"],
        "winners": winners,
        "recipientCount": len(recipients),
    }


def _upsert_log(
    session: Session, year: int, month: int, recipient_count: int, winner_names: str, triggered_by: str
) -> None:
    existing = _log_for(session, year, month)
    if existing:
        existing.sentAt = datetime.utcnow()
        existing.recipientCount = recipient_count
        existing.winnerNames = winner_names
        existing.triggeredBy = triggered_by
        session.add(existing)
    else:
        session.add(
            MonthlyAnnouncementLog(
                id=new_id(),
                year=year,
                month=month,
                recipientCount=recipient_count,
                winnerNames=winner_names,
                triggeredBy=triggered_by,
            )
        )
    session.commit()


def get_monthly_winner_email_status(session: Session) -> dict:
    year, month = get_previous_month_kst()
    ranking = get_monthly_ranking(session, year, month)
    winners = get_winners(ranking["leaders"])
    log = _log_for(session, year, month)
    verified_count = len(session.exec(select(User).where(User.emailVerified != None)).all())  # noqa: E711
    return {
        "smtpConfigured": is_smtp_configured(),
        "period": ranking["period"],
        "winners": winners,
        "verifiedRecipientCount": verified_count,
        "lastLog": {
            "sentAt": log.sentAt.isoformat(),
            "recipientCount": log.recipientCount,
            "winnerNames": log.winnerNames,
            "triggeredBy": log.triggeredBy,
        }
        if log
        else None,
    }
