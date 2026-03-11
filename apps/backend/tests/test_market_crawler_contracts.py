from __future__ import annotations

from datetime import date, datetime, timezone

from app.modules.batch_data.market_crawler.domain.contracts import (
    CrawlerJobParams,
    FetchedPayload,
    NormalizedRecord,
    ParsedRow,
    ValidationResult,
)


def test_contracts_hold_expected_data() -> None:
    params = CrawlerJobParams(
        dataset_code="taifex_institution_open_interest_daily",
        target_date=date(2026, 3, 7),
        trigger_type="manual",
    )
    payload = FetchedPayload(
        content=b"col1,col2\n1,2\n",
        content_type="text/csv",
        fetched_at=datetime.now(timezone.utc),
        source_url="https://example.com/source.csv",
    )
    parsed = ParsedRow(raw_fields={"entity": "foreign", "long_oi": "123"})
    normalized = NormalizedRecord(
        dataset_code=params.dataset_code,
        data_date=params.target_date,
        market_code="TAIFEX",
        instrument_code="TX",
        entity_code="foreign",
        payload={"long_trade_oi": 123},
    )
    validated = ValidationResult(is_valid=True, errors=[], normalized_records=[normalized])

    assert params.dataset_code == "taifex_institution_open_interest_daily"
    assert payload.content_type == "text/csv"
    assert parsed.raw_fields["entity"] == "foreign"
    assert validated.is_valid is True
    assert validated.normalized_records[0].payload["long_trade_oi"] == 123
