from __future__ import annotations

from datetime import date

from app.modules.batch_data.market_crawler.normalizers import (
    TaifexInstitutionOpenInterestNormalizer,
)
from app.modules.batch_data.market_crawler.parsers import TaifexCsvParser
from app.modules.batch_data.market_crawler.validators import (
    TaifexInstitutionOpenInterestValidator,
)


def test_mvp_parser_normalizer_validator_success() -> None:
    csv_text = (
        "data_date,market_code,instrument_code,entity_code,long_trade_oi,short_trade_oi,net_trade_oi,"
        "long_trade_amount_k,short_trade_amount_k,net_trade_amount_k,long_open_interest,short_open_interest,"
        "net_open_interest,long_open_interest_amount_k,short_open_interest_amount_k,net_open_interest_amount_k,source\n"
        "2026-03-09,TAIFEX,TX,foreign,100,50,50,10,5,5,120,60,60,12,6,6,taifex_data_gov\n"
    )
    parser = TaifexCsvParser()
    normalizer = TaifexInstitutionOpenInterestNormalizer()
    validator = TaifexInstitutionOpenInterestValidator()

    parsed = parser.parse(csv_text)
    normalized = normalizer.normalize(parsed, dataset_code="taifex_institution_open_interest_daily")
    validation = validator.validate(normalized)

    assert validation.is_valid is True
    assert len(validation.normalized_records) == 1
    assert validation.normalized_records[0].data_date == date(2026, 3, 9)


def test_validator_flags_publication_not_ready_on_empty_rows() -> None:
    validator = TaifexInstitutionOpenInterestValidator()

    validation = validator.validate([])

    assert validation.is_valid is False
    assert "publication not ready" in validation.errors[0].lower()
