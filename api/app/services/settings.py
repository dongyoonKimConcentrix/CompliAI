from datetime import datetime

from sqlmodel import Session, select

from app.config import get_settings
from app.models import AppSetting

settings = get_settings()
SETTING_KEY = "SARCASM_THRESHOLD"
DEFAULT_THRESHOLD = settings.sarcasm_threshold


def get_sarcasm_threshold(session: Session) -> int:
    """DB app_settings 우선, 없으면 환경 변수 기본값."""
    row = session.exec(select(AppSetting).where(AppSetting.key == SETTING_KEY)).first()
    if row and row.value:
        try:
            value = int(row.value)
            if 0 <= value <= 100:
                return value
        except ValueError:
            pass
    return DEFAULT_THRESHOLD


def set_sarcasm_threshold(session: Session, value: int, admin_id: str) -> None:
    if value < 0 or value > 100:
        raise ValueError("임계치는 0~100 사이여야 합니다.")
    row = session.exec(select(AppSetting).where(AppSetting.key == SETTING_KEY)).first()
    if row:
        row.value = str(value)
        row.updatedBy = admin_id
        row.updatedAt = datetime.utcnow()
        session.add(row)
    else:
        session.add(
            AppSetting(key=SETTING_KEY, value=str(value), updatedBy=admin_id, updatedAt=datetime.utcnow())
        )
    session.commit()
