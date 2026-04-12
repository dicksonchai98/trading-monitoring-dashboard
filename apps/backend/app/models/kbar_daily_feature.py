"""Daily feature aggregates derived from intraday k-bars."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class KbarDailyFeatureModel(Base):
    __tablename__ = "kbar_daily_features"
    __table_args__ = (Index("ix_kbar_daily_features_trade_date", "trade_date"),)

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    day_open: Mapped[float] = mapped_column(Float, nullable=False)
    day_high: Mapped[float] = mapped_column(Float, nullable=False)
    day_low: Mapped[float] = mapped_column(Float, nullable=False)
    day_close: Mapped[float] = mapped_column(Float, nullable=False)
    day_volume: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    day_return: Mapped[float] = mapped_column(Float, nullable=False)
    day_range: Mapped[float] = mapped_column(Float, nullable=False)
    day_return_pct: Mapped[float] = mapped_column(Float, nullable=False)
    day_range_pct: Mapped[float] = mapped_column(Float, nullable=False)
    gap_from_prev_close: Mapped[float] = mapped_column(Float, nullable=False)
    close_position: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
