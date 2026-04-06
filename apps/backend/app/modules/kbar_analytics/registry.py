"""Canonical registries for k-bar analytics events and metrics."""

from __future__ import annotations

from typing import Any

EVENT_REGISTRY: dict[str, dict[str, Any]] = {
    "day_up_gt_100": {"group": "direction", "field": "day_return", "op": "gt", "threshold": 100.0},
    "day_up_gt_200": {"group": "direction", "field": "day_return", "op": "gt", "threshold": 200.0},
    "day_down_lt_minus_100": {
        "group": "direction",
        "field": "day_return",
        "op": "lt",
        "threshold": -100.0,
    },
    "day_down_lt_minus_200": {
        "group": "direction",
        "field": "day_return",
        "op": "lt",
        "threshold": -200.0,
    },
    "day_range_gt_200": {"group": "range", "field": "day_range", "op": "gt", "threshold": 200.0},
    "day_range_gt_300": {"group": "range", "field": "day_range", "op": "gt", "threshold": 300.0},
    "close_position_gt_0_8": {
        "group": "close_strength",
        "field": "close_position",
        "op": "gt",
        "threshold": 0.8,
    },
    "close_position_lt_0_2": {
        "group": "close_strength",
        "field": "close_position",
        "op": "lt",
        "threshold": 0.2,
    },
    "gap_up_gt_100": {
        "group": "gap",
        "field": "gap_from_prev_close",
        "op": "gt",
        "threshold": 100.0,
    },
    "gap_down_lt_minus_100": {
        "group": "gap",
        "field": "gap_from_prev_close",
        "op": "lt",
        "threshold": -100.0,
    },
}

METRIC_REGISTRY: list[str] = [
    "day_range",
    "day_range_pct",
    "day_return",
    "day_return_pct",
    "gap_from_prev_close",
    "close_position",
]


def ensure_event_exists(event_id: str) -> None:
    if event_id not in EVENT_REGISTRY:
        raise KeyError("event_not_found")


def ensure_metric_exists(metric_id: str) -> None:
    if metric_id not in METRIC_REGISTRY:
        raise KeyError("metric_not_found")


def evaluate_event(event_id: str, feature: dict[str, float]) -> tuple[bool, float]:
    rule = EVENT_REGISTRY[event_id]
    value = float(feature[rule["field"]])
    threshold = float(rule["threshold"])
    op = str(rule["op"])
    if op == "gt":
        return value > threshold, value
    return value < threshold, value
