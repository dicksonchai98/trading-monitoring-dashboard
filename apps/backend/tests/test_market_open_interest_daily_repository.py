from __future__ import annotations

from datetime import date

from app.db.session import SessionLocal
from app.models.market_open_interest_daily import MarketOpenInterestDailyModel
from app.modules.batch_data.market_crawler.domain.contracts import NormalizedRecord
from app.modules.batch_data.market_crawler.repositories.market_open_interest_repository import (
    MarketOpenInterestRepository,
)


def test_repository_upsert_by_unique_key() -> None:
    repo = MarketOpenInterestRepository(session_factory=SessionLocal)
    record1 = NormalizedRecord(
        dataset_code="taifex_institution_open_interest_daily",
        data_date=date(2026, 3, 9),
        market_code="TAIFEX",
        instrument_code="TX",
        entity_code="foreign",
        payload={
            "long_trade_oi": 100,
            "short_trade_oi": 50,
            "net_trade_oi": 50,
            "long_trade_amount_k": 10,
            "short_trade_amount_k": 5,
            "net_trade_amount_k": 5,
            "long_open_interest": 120,
            "short_open_interest": 60,
            "net_open_interest": 60,
            "long_open_interest_amount_k": 12,
            "short_open_interest_amount_k": 6,
            "net_open_interest_amount_k": 6,
            "source": "taifex_data_gov",
            "parser_version": "v1",
        },
    )
    record2 = NormalizedRecord(
        dataset_code=record1.dataset_code,
        data_date=record1.data_date,
        market_code=record1.market_code,
        instrument_code=record1.instrument_code,
        entity_code=record1.entity_code,
        payload={**record1.payload, "long_trade_oi": 101},
    )

    assert repo.upsert_records([record1]) == 1
    assert repo.upsert_records([record2]) == 1

    with SessionLocal() as session:
        rows = session.query(MarketOpenInterestDailyModel).all()
        assert len(rows) == 1
        assert rows[0].long_trade_oi == 101
