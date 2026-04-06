"""Event-matched daily samples for next-day analytics."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class KbarEventSampleModel(Base):
    __tablename__ = "kbar_event_samples"
    __table_args__ = (
        Index("ix_kbar_event_samples_event_code_trade_date", "event_id", "code", "trade_date"),
        Index("ix_kbar_event_samples_code_trade_date", "code", "trade_date"),
    )

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    next_trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_value: Mapped[float] = mapped_column(Float, nullable=False)
    event_day_return: Mapped[float] = mapped_column(Float, nullable=False)
    event_day_range: Mapped[float] = mapped_column(Float, nullable=False)
    next_day_open: Mapped[float] = mapped_column(Float, nullable=False)
    next_day_high: Mapped[float] = mapped_column(Float, nullable=False)
    next_day_low: Mapped[float] = mapped_column(Float, nullable=False)
    next_day_close: Mapped[float] = mapped_column(Float, nullable=False)
    next_day_return: Mapped[float] = mapped_column(Float, nullable=False)
    next_day_range: Mapped[float] = mapped_column(Float, nullable=False)
    next_day_gap: Mapped[float] = mapped_column(Float, nullable=False)
    next_day_category: Mapped[str] = mapped_column(String(16), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
