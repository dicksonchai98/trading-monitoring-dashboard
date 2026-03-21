from __future__ import annotations

import pytest
from app.market_ingestion.spot_symbols import (
    load_and_validate_spot_symbols,
    parse_spot_symbols,
    validate_spot_symbols,
)


def test_parse_spot_symbols_supports_blank_and_comment_lines() -> None:
    parsed = parse_spot_symbols("# comment\n\n2330\n2317\n")
    assert parsed == ["2330", "2317"]


def test_validate_spot_symbols_rejects_duplicates() -> None:
    with pytest.raises(ValueError, match="duplicates"):
        validate_spot_symbols(["2330", "2330"], expected_count=2)


def test_validate_spot_symbols_rejects_invalid_format() -> None:
    with pytest.raises(ValueError, match="invalid format"):
        validate_spot_symbols(["2330", "ABC"], expected_count=2)


def test_load_and_validate_spot_symbols_success(tmp_path) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\n2317\n", encoding="utf-8")
    symbols = load_and_validate_spot_symbols(symbols_file, expected_count=2)
    assert symbols == ["2330", "2317"]
