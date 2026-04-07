from __future__ import annotations

from datetime import datetime

from app.stream_processing.runner import BidAskStateMachine, MetricsRegistry, unix_seconds


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
    series_fields = {
        "bid_total_vol",
        "ask_total_vol",
        "imbalance",
        "ratio",
        "delta_bid_total_vol_1s",
        "delta_ask_total_vol_1s",
    }

    t0 = datetime.fromisoformat("2026-03-05T09:31:00+08:00")
    state.update_latest(t0, {"bid_total_vol": 120, "ask_total_vol": 100})
    assert state.emit_samples_up_to(unix_seconds(t0) - 1, series_fields) == []

    t1 = datetime.fromisoformat("2026-03-05T09:31:01+08:00")
    state.update_latest(t1, {"bid_total_vol": 128, "ask_total_vol": 97})
    emitted0 = state.emit_samples_up_to(unix_seconds(t1) - 1, series_fields)
    assert len(emitted0) == 1
    second0_full = emitted0[0][1]
    assert second0_full["main_force_big_order"] == 20
    assert second0_full["main_force_big_order_day_high"] == 20
    assert second0_full["main_force_big_order_day_low"] == 20
    assert second0_full["main_force_big_order_strength"] == 0.5

    t2 = datetime.fromisoformat("2026-03-05T09:31:02+08:00")
    emitted1 = state.emit_samples_up_to(unix_seconds(t2) - 1, series_fields)
    assert len(emitted1) == 1
    second1_full = emitted1[0][1]
    second1_series = emitted1[0][2]
    assert second1_full["main_force_big_order"] == 31
    assert second1_full["main_force_big_order_day_high"] == 31
    assert second1_full["main_force_big_order_day_low"] == 20
    assert second1_full["main_force_big_order_strength"] == 1.0
    assert second1_series["delta_bid_total_vol_1s"] == 8
    assert second1_series["delta_ask_total_vol_1s"] == -3

    t3 = datetime.fromisoformat("2026-03-05T09:31:03+08:00")
    emitted_carry = state.emit_samples_up_to(unix_seconds(t3) - 1, series_fields)
    assert len(emitted_carry) == 1
    assert emitted_carry[0][2]["delta_bid_total_vol_1s"] == 0
    assert emitted_carry[0][2]["delta_ask_total_vol_1s"] == 0


def test_bidask_same_second_keeps_last_event_and_next_second_emits_once() -> None:
    state = BidAskStateMachine(MetricsRegistry())
    series_fields = {"bid_total_vol", "ask_total_vol", "imbalance"}

    t0a = datetime.fromisoformat("2026-03-05T09:31:00+08:00")
    t0b = datetime.fromisoformat("2026-03-05T09:31:00.800000+08:00")
    t1 = datetime.fromisoformat("2026-03-05T09:31:01+08:00")

    state.update_latest(t0a, {"bid_total_vol": 120, "ask_total_vol": 100})
    state.update_latest(t0b, {"bid_total_vol": 130, "ask_total_vol": 99})
    emitted_before_close = state.emit_samples_up_to(unix_seconds(t0a) - 1, series_fields)
    assert emitted_before_close == []

    state.update_latest(t1, {"bid_total_vol": 131, "ask_total_vol": 98})
    emitted = state.emit_samples_up_to(unix_seconds(t0a), series_fields)
    assert len(emitted) == 1
    assert emitted[0][1]["bid_total_vol"] == 130
    assert emitted[0][1]["ask_total_vol"] == 99
