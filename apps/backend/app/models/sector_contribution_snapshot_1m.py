"""Persisted sector contribution snapshots (1-minute)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SectorContributionSnapshot1mModel(Base):
    __tablename__ = "sector_contribution_snapshot_1m"
    __table_args__ = (
        UniqueConstraint(
            "index_code",
            "minute_ts",
            "sector",
            name="uq_sector_contribution_snapshot_1m_index_code_minute_ts_sector",
        ),
        Index(
            "ix_sector_contribution_snapshot_1m_index_code_trade_date",
            "index_code",
            "trade_date",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    index_code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    minute_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    sector: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    contribution_points: Mapped[float] = mapped_column(Float, nullable=False)
    weight_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
