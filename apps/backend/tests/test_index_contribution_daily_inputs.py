from __future__ import annotations

import pytest
from app.index_contribution.daily_inputs import ConstituentMeta, DailyInputLoader


def _build_loader(
    *,
    index_prev_close: float = 22000.0,
    weights: list[ConstituentMeta] | None = None,
) -> DailyInputLoader:
    if weights is None:
        weights = [
            ConstituentMeta(
                symbol="2330",
                symbol_name="TSMC",
                weight=0.31,
                weight_version="2026-04-06-v1",
                weight_generated_at="2026-04-06T08:30:00+08:00",
                table_sector="Semiconductor",
            )
        ]
    return DailyInputLoader(
        weight_provider=lambda: weights,
        sector_mapping_provider=lambda: {"2330": "Semiconductor"},
        index_prev_close_provider=lambda: index_prev_close,
    )


def test_daily_input_loader_loads_valid_inputs() -> None:
    loader = _build_loader()

    result = loader.load()

    assert result.index_prev_close == 22000.0
    assert "2330" in result.constituents
    assert result.sector_mapping["2330"] == "Semiconductor"


def test_daily_input_loader_fails_on_invalid_index_prev_close() -> None:
    loader = _build_loader(index_prev_close=0.0)

    with pytest.raises(RuntimeError, match="index_prev_close"):
        loader.load()


def test_daily_input_loader_fails_on_invalid_weight() -> None:
    loader = _build_loader(
        weights=[
            ConstituentMeta(
                symbol="2330",
                symbol_name="TSMC",
                weight=1.2,
                weight_version="2026-04-06-v1",
                weight_generated_at="2026-04-06T08:30:00+08:00",
                table_sector="Semiconductor",
            )
        ]
    )

    with pytest.raises(RuntimeError, match="invalid constituent weight"):
        loader.load()
