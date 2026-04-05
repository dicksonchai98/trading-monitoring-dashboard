"""Taiwan stock contribution point calculation service."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StockContributionInput:
    symbol: str
    current_price: float
    reference_price: float
    index_weight_percent: float


@dataclass(frozen=True)
class StockContributionResult:
    symbol: str
    contribution_points: float


@dataclass(frozen=True)
class TotalContributionResult:
    total_points: float
    items: list[StockContributionResult]


class TwStockContributionService:
    @staticmethod
    def compute_stock_contribution_points(
        index_reference_level: float,
        item: StockContributionInput,
    ) -> float:
        TwStockContributionService._validate_inputs(index_reference_level, item)
        pct_change = (item.current_price - item.reference_price) / item.reference_price
        weight_ratio = item.index_weight_percent / 100.0
        return index_reference_level * weight_ratio * pct_change

    @staticmethod
    def compute_total_contribution_points(
        index_reference_level: float,
        items: list[StockContributionInput],
    ) -> TotalContributionResult:
        results = [
            StockContributionResult(
                symbol=item.symbol,
                contribution_points=TwStockContributionService.compute_stock_contribution_points(
                    index_reference_level=index_reference_level,
                    item=item,
                ),
            )
            for item in items
        ]
        sorted_results = sorted(
            results, key=lambda value: abs(value.contribution_points), reverse=True
        )
        total_points = sum(entry.contribution_points for entry in sorted_results)
        return TotalContributionResult(total_points=total_points, items=sorted_results)

    @staticmethod
    def _validate_inputs(index_reference_level: float, item: StockContributionInput) -> None:
        if index_reference_level <= 0:
            raise ValueError("index_reference_level must be positive")
        if item.reference_price <= 0:
            raise ValueError("reference_price must be positive")
        if item.index_weight_percent < 0:
            raise ValueError("index_weight_percent must be non-negative")
