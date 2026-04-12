"""Daily input loading and validation for index contribution worker."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class ConstituentMeta:
    symbol: str
    symbol_name: str
    weight: float
    weight_version: str
    weight_generated_at: str
    table_sector: str | None = None


@dataclass(frozen=True)
class DailyInputs:
    index_prev_close: float
    constituents: dict[str, ConstituentMeta]
    sector_mapping: dict[str, str]


class DailyInputLoader:
    """Loads and validates per-trade-date required inputs."""

    def __init__(
        self,
        *,
        weight_provider: Callable[[], list[ConstituentMeta]],
        sector_mapping_provider: Callable[[], dict[str, str]],
        index_prev_close_provider: Callable[[], float],
    ) -> None:
        self._weight_provider = weight_provider
        self._sector_mapping_provider = sector_mapping_provider
        self._index_prev_close_provider = index_prev_close_provider

    def load(self) -> DailyInputs:
        index_prev_close = float(self._index_prev_close_provider())
        if index_prev_close <= 0:
            raise RuntimeError("index_prev_close must be positive")

        rows = self._weight_provider()
        if not rows:
            raise RuntimeError("constituent weight table is empty")
        constituents: dict[str, ConstituentMeta] = {}
        for row in rows:
            if not row.symbol.strip():
                raise RuntimeError("constituent symbol is required")
            if row.weight < 0 or row.weight > 1:
                raise RuntimeError(f"invalid constituent weight for symbol={row.symbol}")
            constituents[row.symbol] = row

        sector_mapping = self._sector_mapping_provider()
        return DailyInputs(
            index_prev_close=index_prev_close,
            constituents=constituents,
            sector_mapping=sector_mapping,
        )
