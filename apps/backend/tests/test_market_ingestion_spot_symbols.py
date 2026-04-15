from __future__ import annotations

import pytest
from app.market_ingestion.spot_symbols import (
    classify_spot_symbols,
    load_and_validate_spot_symbols,
    parse_spot_symbols,
    validate_spot_symbols,
)


def test_parse_spot_symbols_supports_blank_and_comment_lines() -> None:
    parsed = parse_spot_symbols("# comment\n\n2330\n2317\n")
    assert parsed == ["2330", "2317"]


def test_parse_spot_symbols_supports_utf8_bom_prefixed_comment() -> None:
    parsed = parse_spot_symbols("\ufeff# comment\n2330\n2317\n")
    assert parsed == ["2330", "2317"]


def test_validate_spot_symbols_rejects_duplicates() -> None:
    with pytest.raises(ValueError, match="duplicates"):
        validate_spot_symbols(["2330", "2330"], expected_count=2)


def test_validate_spot_symbols_rejects_invalid_format() -> None:
    with pytest.raises(ValueError, match="invalid format"):
        validate_spot_symbols(["2330", "ABC"], expected_count=2)


def test_classify_spot_symbols_filters_invalid_and_duplicate_entries() -> None:
    result = classify_spot_symbols(["2330", "ABC", "2317", "2330", "12"])
    assert result.valid_symbols == ["2330", "2317"]
    assert result.duplicate_symbols == ["2330"]
    assert result.invalid_symbols == ["ABC", "12"]


def test_load_and_validate_spot_symbols_success(tmp_path) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\n2317\n", encoding="utf-8")
    symbols = load_and_validate_spot_symbols(symbols_file, expected_count=2)
    assert symbols == ["2330", "2317"]
