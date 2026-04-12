"""Aggregated event statistics for next-day outcomes."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class KbarEventStatModel(Base):
    __tablename__ = "kbar_event_stats"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "code",
            "start_date",
            "end_date",
            "computed_at",
            name="uq_kbar_event_stats_latest",
        ),
        Index("ix_kbar_event_stats_event_code_computed", "event_id", "code", "computed_at"),
    )

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    start_date: Mapped[date] = mapped_column(Date, primary_key=True)
    end_date: Mapped[date] = mapped_column(Date, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)
    up_count: Mapped[int] = mapped_column(Integer, nullable=False)
    down_count: Mapped[int] = mapped_column(Integer, nullable=False)
    flat_count: Mapped[int] = mapped_column(Integer, nullable=False)
    up_probability: Mapped[float] = mapped_column(Float, nullable=False)
    down_probability: Mapped[float] = mapped_column(Float, nullable=False)
    flat_probability: Mapped[float] = mapped_column(Float, nullable=False)
    avg_next_day_return: Mapped[float] = mapped_column(Float, nullable=False)
    median_next_day_return: Mapped[float] = mapped_column(Float, nullable=False)
    avg_next_day_range: Mapped[float] = mapped_column(Float, nullable=False)
    avg_next_day_gap: Mapped[float] = mapped_column(Float, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
