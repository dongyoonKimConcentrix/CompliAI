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
