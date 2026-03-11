"""Persistence for market open-interest dataset."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from sqlalchemy.orm import Session

from app.models.market_open_interest_daily import MarketOpenInterestDailyModel
from app.modules.batch_data.market_crawler.domain.contracts import NormalizedRecord
from app.modules.batch_shared.database.helpers import upsert


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class MarketOpenInterestRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def upsert_records(self, records: list[NormalizedRecord]) -> int:
        if not records:
            return 0
        rows = []
        for record in records:
            payload = record.payload
            rows.append(
                {
                    "data_date": record.data_date,
                    "market_code": record.market_code,
                    "instrument_code": record.instrument_code,
                    "entity_code": record.entity_code,
                    "long_trade_oi": payload["long_trade_oi"],
                    "short_trade_oi": payload["short_trade_oi"],
                    "net_trade_oi": payload["net_trade_oi"],
                    "long_trade_amount_k": payload["long_trade_amount_k"],
                    "short_trade_amount_k": payload["short_trade_amount_k"],
                    "net_trade_amount_k": payload["net_trade_amount_k"],
                    "long_open_interest": payload["long_open_interest"],
                    "short_open_interest": payload["short_open_interest"],
                    "net_open_interest": payload["net_open_interest"],
                    "long_open_interest_amount_k": payload["long_open_interest_amount_k"],
                    "short_open_interest_amount_k": payload["short_open_interest_amount_k"],
                    "net_open_interest_amount_k": payload["net_open_interest_amount_k"],
                    "source": payload["source"],
                    "parser_version": payload["parser_version"],
                    "ingested_at": _utcnow(),
                }
            )
        with self._session_factory() as session:
            upsert(
                session=session,
                table=MarketOpenInterestDailyModel.__table__,
                rows=rows,
                conflict_columns=[
                    "data_date",
                    "market_code",
                    "instrument_code",
                    "entity_code",
                    "source",
                ],
                update_columns=[
                    "long_trade_oi",
                    "short_trade_oi",
                    "net_trade_oi",
                    "long_trade_amount_k",
                    "short_trade_amount_k",
                    "net_trade_amount_k",
                    "long_open_interest",
                    "short_open_interest",
                    "net_open_interest",
                    "long_open_interest_amount_k",
                    "short_open_interest_amount_k",
                    "net_open_interest_amount_k",
                    "parser_version",
                    "ingested_at",
                ],
            )
            session.commit()
        return len(rows)
