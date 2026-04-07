from __future__ import annotations

from datetime import datetime

from app.stream_processing.runner import BidAskStateMachine, MetricsRegistry


def test_metrics_registry_computes_bidask_volume_indicators() -> None:
    metrics = MetricsRegistry().compute(
        {
            "bid_total_vol": 120,
            "ask_total_vol": 100,
            "bid": 19530,
            "ask": 19532,
            "bid_size": 8,
            "ask_size": 6,
        }
    )

    assert metrics["bid_total_vol"] == 120
    assert metrics["ask_total_vol"] == 100
    assert metrics["imbalance"] == 20
    assert metrics["ratio"] == 1.2
    assert metrics["mid"] == 19531
    assert metrics["spread"] == 2


def test_bidask_sampling_computes_per_second_volume_deltas() -> None:
    state = BidAskStateMachine(MetricsRegistry())
    samples: list[dict[str, float | int]] = []

    def on_sample(_second: int, sample: dict[str, float | int]) -> None:
        samples.append(sample)

    series_fields = {
        "bid_total_vol",
        "ask_total_vol",
        "imbalance",
        "ratio",
        "delta_bid_total_vol_1s",
        "delta_ask_total_vol_1s",
    }

    t0 = datetime.fromisoformat("2026-03-05T09:31:00+08:00")
    latest0 = state.update_latest(t0, {"bid_total_vol": 120, "ask_total_vol": 100})
    assert latest0["main_force_big_order"] == 20
    assert latest0["main_force_big_order_day_high"] == 20
    assert latest0["main_force_big_order_day_low"] == 20
    assert latest0["main_force_big_order_strength"] == 0.5
    assert state.sample_series(t0, series_fields, on_sample) == 1
    assert "delta_bid_total_vol_1s" not in samples[0]
    assert "delta_ask_total_vol_1s" not in samples[0]

    t1 = datetime.fromisoformat("2026-03-05T09:31:01+08:00")
    latest1 = state.update_latest(t1, {"bid_total_vol": 128, "ask_total_vol": 97})
    assert latest1["main_force_big_order"] == 31
    assert latest1["main_force_big_order_day_high"] == 31
    assert latest1["main_force_big_order_day_low"] == 20
    assert latest1["main_force_big_order_strength"] == 1.0
    assert state.sample_series(t1, series_fields, on_sample) == 1
    assert samples[1]["delta_bid_total_vol_1s"] == 8
    assert samples[1]["delta_ask_total_vol_1s"] == -3

    t2 = datetime.fromisoformat("2026-03-05T09:31:02+08:00")
    assert state.sample_series(t2, series_fields, on_sample) == 1
    assert samples[2]["delta_bid_total_vol_1s"] == 0
    assert samples[2]["delta_ask_total_vol_1s"] == 0
