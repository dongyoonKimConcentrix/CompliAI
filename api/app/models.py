from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, DateTime, Enum as SAEnum, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class ModerationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class User(SQLModel, table=True):
    __tablename__ = "User"

    id: str = Field(primary_key=True)
    email: str = Field(unique=True, index=True)
    passwordHash: str
    name: str
    displayId: str = Field(unique=True)
    role: UserRole = Field(
        default=UserRole.USER,
        sa_column=Column(SAEnum(UserRole, name="UserRole", create_type=False), nullable=False),
    )
    profileImage: Optional[str] = None
    emailVerified: Optional[datetime] = None
    verificationToken: Optional[str] = Field(default=None, unique=True)
    passwordResetToken: Optional[str] = Field(default=None, unique=True)
    passwordResetTokenExpiresAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )


class Post(SQLModel, table=True):
    __tablename__ = "Post"

    id: str = Field(primary_key=True)
    title: str
    content: str
    targetUserId: str = Field(index=True)
    fileUrl: Optional[str] = None
    isBlinded: bool = False
    sarcasmScore: int = 0
    aggression: bool = False
    aiReport: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True))
    moderationStatus: ModerationStatus = Field(
        default=ModerationStatus.APPROVED,
        sa_column=Column(
            SAEnum(ModerationStatus, name="ModerationStatus", create_type=False), nullable=False
        ),
    )
    adminReviewedAt: Optional[datetime] = None
    adminReviewedBy: Optional[str] = None
    authorId: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )


class Comment(SQLModel, table=True):
    __tablename__ = "Comment"

    id: str = Field(primary_key=True)
    content: str
    isBlinded: bool = False
    sarcasmScore: int = 0
    aggression: bool = False
    aiReport: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True))
    moderationStatus: ModerationStatus = Field(
        default=ModerationStatus.APPROVED,
        sa_column=Column(
            SAEnum(ModerationStatus, name="ModerationStatus", create_type=False), nullable=False
        ),
    )
    adminReviewedAt: Optional[datetime] = None
    adminReviewedBy: Optional[str] = None
    postId: str = Field(index=True)
    authorId: str
    parentId: Optional[str] = Field(default=None, index=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )


class Like(SQLModel, table=True):
    __tablename__ = "Like"
    __table_args__ = (UniqueConstraint("postId", "userId"),)

    id: str = Field(primary_key=True)
    postId: str
    userId: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class Report(SQLModel, table=True):
    __tablename__ = "Report"
    __table_args__ = (UniqueConstraint("postId", "userId"),)

    id: str = Field(primary_key=True)
    postId: str
    userId: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_settings"

    key: str = Field(primary_key=True)
    value: str
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    updatedBy: Optional[str] = None


class MonthlyAnnouncementLog(SQLModel, table=True):
    __tablename__ = "monthly_announcement_logs"
    __table_args__ = (UniqueConstraint("year", "month"),)

    id: str = Field(primary_key=True)
    year: int
    month: int
    sentAt: datetime = Field(default_factory=datetime.utcnow)
    recipientCount: int = 0
    winnerNames: str = ""
    triggeredBy: str = "cron"


class AIAnalysisLog(SQLModel, table=True):
    __tablename__ = "ai_analysis_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    content_type: str = Field(index=True)
    content_id: int = Field(index=True)
    text: str
    sarcasm_score: int = 0
    aggression: bool = False
    is_blocked: bool = False
    ai_report: str = "{}"
    created_at: datetime = Field(default_factory=datetime.utcnow)
