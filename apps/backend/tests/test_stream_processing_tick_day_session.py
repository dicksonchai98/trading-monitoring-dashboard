from __future__ import annotations

from datetime import datetime

from app.stream_processing.runner import TickStateMachine


def _tick(state: TickStateMachine, ts: str, price: float) -> None:
    event_ts = datetime.fromisoformat(ts)
    archived, dropped = state.apply_tick(
        code="TXFD6",
        event_ts=event_ts,
        payload={"price": price, "volume": 1},
    )
    assert dropped is False
    _ = archived


def test_day_amplitude_counts_only_0845_to_1345() -> None:
    state = TickStateMachine()

    _tick(state, "2026-04-09T08:40:00+08:00", 100)
    current = state.current
    assert current is not None
    assert current.to_dict()["day_amplitude"] is None

    _tick(state, "2026-04-09T08:45:00+08:00", 101)
    current = state.current
    assert current is not None
    assert current.to_dict()["day_amplitude"] == 0

    _tick(state, "2026-04-09T09:10:00+08:00", 110)
    current = state.current
    assert current is not None
    assert current.to_dict()["day_amplitude"] == 9

    _tick(state, "2026-04-09T13:46:00+08:00", 200)
    current = state.current
    assert current is not None
    # out-of-session ticks do not change day session amplitude
    assert current.to_dict()["day_amplitude"] == 9
