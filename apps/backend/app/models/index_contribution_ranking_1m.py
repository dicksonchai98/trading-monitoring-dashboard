"""Persisted top/bottom ranking snapshots (1-minute)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IndexContributionRanking1mModel(Base):
    __tablename__ = "index_contribution_ranking_1m"
    __table_args__ = (
        UniqueConstraint(
            "index_code",
            "minute_ts",
            "ranking_type",
            "rank_no",
            name="uq_index_contribution_ranking_1m_index_code_minute_ts_type_rank",
        ),
        Index(
            "ix_index_contribution_ranking_1m_index_code_trade_date",
            "index_code",
            "trade_date",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    index_code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    minute_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ranking_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    rank_no: Mapped[int] = mapped_column(Integer, nullable=False)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False)
    symbol_name: Mapped[str] = mapped_column(String(64), nullable=False)
    sector: Mapped[str] = mapped_column(String(64), nullable=False)
    contribution_points: Mapped[float] = mapped_column(Float, nullable=False)
    weight_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
