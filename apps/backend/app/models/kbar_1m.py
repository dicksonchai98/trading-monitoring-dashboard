"""K bar (1-minute) persisted snapshots."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Kbar1mModel(Base):
    __tablename__ = "kbars_1m"
    __table_args__ = (
        UniqueConstraint("code", "minute_ts", name="uq_kbars_1m_code_minute_ts"),
        Index("ix_kbars_1m_code_trade_date", "code", "trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    minute_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    open: Mapped[float] = mapped_column(Float, nullable=False)
    high: Mapped[float] = mapped_column(Float, nullable=False)
    low: Mapped[float] = mapped_column(Float, nullable=False)
    close: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    amplitude: Mapped[float | None] = mapped_column(Float, nullable=True, default=0)
    amplitude_pct: Mapped[float | None] = mapped_column(Float, nullable=True, default=0)
