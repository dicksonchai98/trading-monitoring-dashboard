from __future__ import annotations

from datetime import datetime, timezone

import pytest
from app.index_contribution.engine import IndexContributionEngine


@pytest.fixture
def engine() -> IndexContributionEngine:
    return IndexContributionEngine(index_code="TSE001", index_prev_close=22000.0)


def test_compute_contribution_rounds_to_six_decimals(engine: IndexContributionEngine) -> None:
    value = engine.compute_contribution_points(last_price=950.0, prev_close=940.0, weight=0.31)

    assert value == pytest.approx(72.553191, rel=1e-9)


def test_compute_contribution_returns_none_for_invalid_inputs(
    engine: IndexContributionEngine,
) -> None:
    assert engine.compute_contribution_points(last_price=100.0, prev_close=0.0, weight=0.1) is None
    assert (
        engine.compute_contribution_points(last_price=100.0, prev_close=50.0, weight=-0.1) is None
    )
    assert engine.compute_contribution_points(last_price=100.0, prev_close=50.0, weight=1.1) is None


def test_apply_update_ignores_duplicate_event_id(engine: IndexContributionEngine) -> None:
    ts = datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc)

    accepted = engine.apply_update(
        symbol="2330",
        symbol_name="TSMC",
        mapping_sector="Semiconductor",
        table_sector="Semiconductor",
        last_price=950.0,
        prev_close=940.0,
        weight=0.31,
        updated_at=ts,
        event_id="evt-1",
    )
    assert accepted is True

    duplicate = engine.apply_update(
        symbol="2330",
        symbol_name="TSMC",
        mapping_sector="Semiconductor",
        table_sector="Semiconductor",
        last_price=951.0,
        prev_close=940.0,
        weight=0.31,
        updated_at=ts,
        event_id="evt-1",
    )

    assert duplicate is False
    assert engine.symbol_state["2330"]["last_price"] == 950.0


def test_apply_update_drops_stale_timestamp(engine: IndexContributionEngine) -> None:
    latest = datetime(2026, 4, 6, 10, 31, tzinfo=timezone.utc)
    stale = datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc)

    assert (
        engine.apply_update(
            symbol="2330",
            symbol_name="TSMC",
            mapping_sector="Semiconductor",
            table_sector="Semiconductor",
            last_price=950.0,
            prev_close=940.0,
            weight=0.31,
            updated_at=latest,
            event_id="evt-2",
        )
        is True
    )

    assert (
        engine.apply_update(
            symbol="2330",
            symbol_name="TSMC",
            mapping_sector="Semiconductor",
            table_sector="Semiconductor",
            last_price=949.0,
            prev_close=940.0,
            weight=0.31,
            updated_at=stale,
            event_id="evt-3",
        )
        is False
    )

    assert engine.symbol_state["2330"]["last_price"] == 950.0


def test_sector_resolution_prefers_mapping(engine: IndexContributionEngine) -> None:
    ts = datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc)

    assert (
        engine.apply_update(
            symbol="2881",
            symbol_name="FUBON",
            mapping_sector="Finance",
            table_sector="Other",
            last_price=70.0,
            prev_close=69.5,
            weight=0.02,
            updated_at=ts,
            event_id="evt-4",
        )
        is True
    )

    assert engine.symbol_state["2881"]["sector"] == "Finance"


def test_rankings_and_sector_aggregate_are_updated(engine: IndexContributionEngine) -> None:
    ts = datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc)

    engine.apply_update(
        symbol="2330",
        symbol_name="TSMC",
        mapping_sector="Semiconductor",
        table_sector="Semiconductor",
        last_price=950.0,
        prev_close=940.0,
        weight=0.31,
        updated_at=ts,
        event_id="evt-5",
    )
    engine.apply_update(
        symbol="2317",
        symbol_name="HonHai",
        mapping_sector="Electronics Manufacturing",
        table_sector="Electronics Manufacturing",
        last_price=200.0,
        prev_close=210.0,
        weight=0.05,
        updated_at=ts,
        event_id="evt-6",
    )

    top = engine.top_ranking(limit=20)
    bottom = engine.bottom_ranking(limit=20)

    assert top[0]["symbol"] == "2330"
    assert bottom[0]["symbol"] == "2317"
    assert "Semiconductor" in engine.sector_aggregate
    assert "Electronics Manufacturing" in engine.sector_aggregate
