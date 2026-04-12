"""BidAsk metrics (1-second) persisted snapshots."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BidAskMetric1sModel(Base):
    __tablename__ = "bidask_metrics_1s"
    __table_args__ = (
        UniqueConstraint("code", "event_ts", name="uq_bidask_metrics_1s_code_event_ts"),
        UniqueConstraint("code", "event_second", name="uq_bidask_metrics_1s_code_event_second"),
        Index("ix_bidask_metrics_1s_code_trade_date", "code", "trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    event_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    event_second: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    bid: Mapped[float | None] = mapped_column(Float, nullable=True)
    ask: Mapped[float | None] = mapped_column(Float, nullable=True)
    spread: Mapped[float | None] = mapped_column(Float, nullable=True)
    mid: Mapped[float | None] = mapped_column(Float, nullable=True)
    bid_size: Mapped[float | None] = mapped_column(Float, nullable=True)
    ask_size: Mapped[float | None] = mapped_column(Float, nullable=True)
    metric_payload: Mapped[str] = mapped_column(Text, nullable=False)
