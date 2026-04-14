from __future__ import annotations

import pytest
from app.services.tw_stock_contribution_service import (
    StockContributionInput,
    TwStockContributionService,
)


def test_compute_stock_contribution_points() -> None:
    item = StockContributionInput(
        symbol="2330",
        current_price=1000.0,
        reference_price=980.0,
        index_weight_percent=35.0,
    )

    points = TwStockContributionService.compute_stock_contribution_points(
        index_reference_level=22000.0,
        item=item,
    )

    assert points == pytest.approx(157.142857, rel=1e-6)


def test_compute_total_contribution_points_sorts_by_absolute_points() -> None:
    items = [
        StockContributionInput(
            symbol="2330",
            current_price=1000.0,
            reference_price=980.0,
            index_weight_percent=35.0,
        ),
        StockContributionInput(
            symbol="2317",
            current_price=204.0,
            reference_price=208.0,
            index_weight_percent=6.5,
        ),
        StockContributionInput(
            symbol="2454",
            current_price=1180.0,
            reference_price=1160.0,
            index_weight_percent=4.2,
        ),
    ]

    result = TwStockContributionService.compute_total_contribution_points(
        index_reference_level=22000.0,
        items=items,
    )

    assert result.total_points == pytest.approx(145.573892, rel=1e-6)
    assert [entry.symbol for entry in result.items] == ["2330", "2317", "2454"]


def test_compute_stock_contribution_points_rejects_non_positive_reference_price() -> None:
    item = StockContributionInput(
        symbol="2330",
        current_price=1000.0,
        reference_price=0.0,
        index_weight_percent=35.0,
    )

    with pytest.raises(ValueError, match="reference_price"):
        TwStockContributionService.compute_stock_contribution_points(
            index_reference_level=22000.0,
            item=item,
        )
