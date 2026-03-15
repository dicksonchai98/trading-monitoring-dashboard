from __future__ import annotations

from datetime import date

from app.modules.market_crawler.normalizers import (
    TaifexInstitutionOpenInterestNormalizer,
)
from app.modules.market_crawler.parsers import TaifexCsvParser
from app.modules.market_crawler.validators import (
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


def test_mvp_parser_normalizer_validator_supports_chinese_headers() -> None:
    csv_text = (
        "\u65e5\u671f,\u5546\u54c1\u5225,\u8eab\u4efd\u5225,"
        "\u591a\u65b9\u4ea4\u6613\u53e3\u6578,\u7a7a\u65b9\u4ea4\u6613\u53e3\u6578,\u591a\u7a7a\u4ea4\u6613\u53e3\u6578\u6de8\u984d,"
        "\u591a\u65b9\u4ea4\u6613\u5951\u7d04\u91d1\u984d(\u767e\u842c\u5143),\u7a7a\u65b9\u4ea4\u6613\u5951\u7d04\u91d1\u984d(\u767e\u842c\u5143),"
        "\u591a\u7a7a\u4ea4\u6613\u5951\u7d04\u91d1\u984d\u6de8\u984d(\u767e\u842c\u5143),"
        "\u591a\u65b9\u672a\u5e73\u5009\u53e3\u6578,\u7a7a\u65b9\u672a\u5e73\u5009\u53e3\u6578,\u591a\u7a7a\u672a\u5e73\u5009\u53e3\u6578\u6de8\u984d,"
        "\u591a\u65b9\u672a\u5e73\u5009\u5951\u7d04\u91d1\u984d(\u767e\u842c\u5143),\u7a7a\u65b9\u672a\u5e73\u5009\u5951\u7d04\u91d1\u984d(\u767e\u842c\u5143),"
        "\u591a\u7a7a\u672a\u5e73\u5009\u5951\u7d04\u91d1\u984d\u6de8\u984d(\u767e\u842c\u5143)\n"
        "2026-03-09,TX,\u5916\u8cc7,100,50,50,10,5,5,120,60,60,12,6,6\n"
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
    assert validation.normalized_records[0].market_code == "TAIFEX"
    assert validation.normalized_records[0].instrument_code == "TX"
    assert validation.normalized_records[0].entity_code == "\u5916\u8cc7"


def test_mvp_parser_normalizer_validator_supports_compact_date_format() -> None:
    csv_text = (
        "\u65e5\u671f,\u5546\u54c1\u5225,\u8eab\u4efd\u5225,"
        "\u591a\u65b9\u4ea4\u6613\u53e3\u6578,\u7a7a\u65b9\u4ea4\u6613\u53e3\u6578,\u591a\u7a7a\u4ea4\u6613\u53e3\u6578\u6de8\u984d,"
        "\u591a\u65b9\u4ea4\u6613\u5951\u7d04\u91d1\u984d(\u767e\u842c\u5143),\u7a7a\u65b9\u4ea4\u6613\u5951\u7d04\u91d1\u984d(\u767e\u842c\u5143),"
        "\u591a\u7a7a\u4ea4\u6613\u5951\u7d04\u91d1\u984d\u6de8\u984d(\u767e\u842c\u5143),"
        "\u591a\u65b9\u672a\u5e73\u5009\u53e3\u6578,\u7a7a\u65b9\u672a\u5e73\u5009\u53e3\u6578,\u591a\u7a7a\u672a\u5e73\u5009\u53e3\u6578\u6de8\u984d,"
        "\u591a\u65b9\u672a\u5e73\u5009\u5951\u7d04\u91d1\u984d(\u767e\u842c\u5143),\u7a7a\u65b9\u672a\u5e73\u5009\u5951\u7d04\u91d1\u984d(\u767e\u842c\u5143),"
        "\u591a\u7a7a\u672a\u5e73\u5009\u5951\u7d04\u91d1\u984d\u6de8\u984d(\u767e\u842c\u5143)\n"
        "20260312,TX,\u5916\u8cc7,100,50,50,10,5,5,120,60,60,12,6,6\n"
    )
    parser = TaifexCsvParser()
    normalizer = TaifexInstitutionOpenInterestNormalizer()
    validator = TaifexInstitutionOpenInterestValidator()

    parsed = parser.parse(csv_text)
    normalized = normalizer.normalize(parsed, dataset_code="taifex_institution_open_interest_daily")
    validation = validator.validate(normalized)

    assert validation.is_valid is True
    assert validation.normalized_records[0].data_date == date(2026, 3, 12)


def test_validator_flags_publication_not_ready_on_empty_rows() -> None:
    validator = TaifexInstitutionOpenInterestValidator()

    validation = validator.validate([])

    assert validation.is_valid is False
    assert "publication not ready" in validation.errors[0].lower()
