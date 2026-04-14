"""In-memory attribution engine for index contribution worker."""

from __future__ import annotations

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

ROUND_6 = Decimal("0.000001")


def _round6(value: float) -> float:
    return float(Decimal(str(value)).quantize(ROUND_6, rounding=ROUND_HALF_UP))


class IndexContributionEngine:
    """Maintains symbol/ranking/sector state for one index."""

    def __init__(self, index_code: str, index_prev_close: float) -> None:
        self.index_code = index_code
        self.index_prev_close = index_prev_close
        self.symbol_state: dict[str, dict[str, Any]] = {}
        self.sector_aggregate: dict[str, float] = {}
        self._processed_event_ids: set[str] = set()

    def compute_contribution_points(
        self, *, last_price: float, prev_close: float, weight: float
    ) -> float | None:
        if self.index_prev_close <= 0:
            return None
        if prev_close <= 0:
            return None
        if weight < 0 or weight > 1:
            return None
        pct_change = (last_price / prev_close) - 1.0
        value = self.index_prev_close * weight * pct_change
        return _round6(value)

    @staticmethod
    def resolve_sector(*, mapping_sector: str | None, table_sector: str | None) -> str | None:
        if mapping_sector and mapping_sector.strip():
            return mapping_sector.strip()
        if table_sector and table_sector.strip():
            return table_sector.strip()
        return None

    def apply_update(
        self,
        *,
        symbol: str,
        symbol_name: str,
        mapping_sector: str | None,
        table_sector: str | None,
        last_price: float,
        prev_close: float,
        weight: float,
        updated_at: datetime,
        event_id: str | None = None,
    ) -> bool:
        if event_id and event_id in self._processed_event_ids:
            return False

        current = self.symbol_state.get(symbol)
        if current is not None:
            current_updated_at = current.get("updated_at")
            if isinstance(current_updated_at, datetime) and updated_at <= current_updated_at:
                return False

        sector = self.resolve_sector(mapping_sector=mapping_sector, table_sector=table_sector)
        if sector is None:
            return False

        contribution_points = self.compute_contribution_points(
            last_price=last_price,
            prev_close=prev_close,
            weight=weight,
        )
        if contribution_points is None:
            return False

        pct_change = _round6((last_price / prev_close) - 1.0)
        old_contribution = 0.0
        if current is not None:
            old_contribution = float(current["contribution_points"])
            old_sector = str(current["sector"])
            self.sector_aggregate[old_sector] = _round6(
                self.sector_aggregate.get(old_sector, 0.0) - old_contribution
            )
            if abs(self.sector_aggregate[old_sector]) < 1e-12:
                self.sector_aggregate.pop(old_sector, None)

        self.sector_aggregate[sector] = _round6(
            self.sector_aggregate.get(sector, 0.0) + contribution_points
        )
        self.symbol_state[symbol] = {
            "symbol": symbol,
            "symbol_name": symbol_name,
            "sector": sector,
            "last_price": last_price,
            "prev_close": prev_close,
            "weight": weight,
            "pct_change": pct_change,
            "contribution_points": contribution_points,
            "updated_at": updated_at,
            "last_event_id": event_id,
        }
        if event_id:
            self._processed_event_ids.add(event_id)
        return True

    def top_ranking(self, *, limit: int = 20) -> list[dict[str, Any]]:
        ranked = sorted(
            self.symbol_state.values(),
            key=lambda item: (-float(item["contribution_points"]), str(item["symbol"])),
        )
        return ranked[:limit]

    def bottom_ranking(self, *, limit: int = 20) -> list[dict[str, Any]]:
        ranked = sorted(
            self.symbol_state.values(),
            key=lambda item: (float(item["contribution_points"]), str(item["symbol"])),
        )
        return ranked[:limit]
