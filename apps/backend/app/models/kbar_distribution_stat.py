"""Aggregated distribution metrics for daily features."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Date, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class KbarDistributionStatModel(Base):
    __tablename__ = "kbar_distribution_stats"
    __table_args__ = (
        UniqueConstraint(
            "metric_id",
            "code",
            "start_date",
            "end_date",
            "computed_at",
            name="uq_kbar_distribution_stats_latest",
        ),
        Index(
            "ix_kbar_distribution_stats_metric_code_computed", "metric_id", "code", "computed_at"
        ),
    )

    metric_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    start_date: Mapped[date] = mapped_column(Date, primary_key=True)
    end_date: Mapped[date] = mapped_column(Date, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)
    mean: Mapped[float] = mapped_column(Float, nullable=False)
    median: Mapped[float] = mapped_column(Float, nullable=False)
    min: Mapped[float] = mapped_column(Float, nullable=False)
    max: Mapped[float] = mapped_column(Float, nullable=False)
    p25: Mapped[float] = mapped_column(Float, nullable=False)
    p50: Mapped[float] = mapped_column(Float, nullable=False)
    p75: Mapped[float] = mapped_column(Float, nullable=False)
    p90: Mapped[float] = mapped_column(Float, nullable=False)
    p95: Mapped[float] = mapped_column(Float, nullable=False)
    histogram_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
