"""Market summary 1-minute persisted snapshots."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MarketSummary1mModel(Base):
    __tablename__ = "market_summary_1m"
    __table_args__ = (
        UniqueConstraint("market_code", "minute_ts", name="uq_market_summary_1m_code_minute_ts"),
        Index("ix_market_summary_1m_code_trade_date", "market_code", "trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    market_code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    minute_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    index_value: Mapped[float] = mapped_column(Float, nullable=False)
    cumulative_turnover: Mapped[float] = mapped_column(Float, nullable=False)
    completion_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_turnover: Mapped[float | None] = mapped_column(Float, nullable=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
