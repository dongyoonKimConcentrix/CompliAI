from sqlmodel import Session, create_engine

from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url, echo=False)


def get_session():
    with Session(engine) as session:
        yield session


def init_db():
    # 스키마는 Prisma(web/prisma)가 관리합니다. 여기서는 테이블을 생성하지 않습니다.
    return
