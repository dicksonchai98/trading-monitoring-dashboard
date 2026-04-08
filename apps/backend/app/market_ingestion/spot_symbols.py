"""Spot symbol registry loading and validation."""

from __future__ import annotations

import re
from pathlib import Path

_SYMBOL_PATTERN = re.compile(r"^\d{4}$")


def parse_spot_symbols(content: str) -> list[str]:
    symbols: list[str] = []
    for raw_line in content.splitlines():
        line = raw_line.lstrip("\ufeff").strip()
        if not line or line.startswith("#"):
            continue
        symbols.append(line)
    return symbols


def load_spot_symbols_from_file(path: str | Path) -> list[str]:
    content = Path(path).read_text(encoding="utf-8")
    return parse_spot_symbols(content)


def validate_spot_symbols(symbols: list[str], expected_count: int) -> None:
    if not symbols:
        raise ValueError("spot symbol list is empty")
    duplicates: set[str] = set()
    seen: set[str] = set()
    for symbol in symbols:
        if symbol in seen:
            duplicates.add(symbol)
        seen.add(symbol)
    if duplicates:
        raise ValueError(f"spot symbol list contains duplicates: {sorted(duplicates)}")
    invalid = [symbol for symbol in symbols if _SYMBOL_PATTERN.fullmatch(symbol) is None]
    if invalid:
        raise ValueError(f"spot symbol list contains invalid format: {invalid[:10]}")
    if expected_count <= 0:
        raise ValueError("INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT must be > 0")
    if len(symbols) != expected_count:
        raise ValueError(
            "spot symbol count mismatch: " f"actual={len(symbols)} expected={expected_count}"
        )


def load_and_validate_spot_symbols(path: str | Path, expected_count: int) -> list[str]:
    symbols = load_spot_symbols_from_file(path)
    validate_spot_symbols(symbols, expected_count)
    return symbols
