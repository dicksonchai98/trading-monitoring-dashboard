from __future__ import annotations

from app.market_ingestion.pipeline import IngestionPipeline
from app.services.metrics import Metrics


def test_enqueue_drops_newest_when_queue_full() -> None:
    metrics = Metrics()
    pipeline = IngestionPipeline(queue_maxsize=1, metrics=metrics)
    first = pipeline.build_event(
        code="MTX",
        quote_type="tick",
        payload={"price": 1},
        event_ts="2026-02-28T00:00:00+00:00",
    )
    second = pipeline.build_event(
        code="MTX",
        quote_type="tick",
        payload={"price": 2},
        event_ts="2026-02-28T00:00:01+00:00",
    )
    assert pipeline.enqueue("dev:stream:tick:MTX", first) is True
    assert pipeline.enqueue("dev:stream:tick:MTX", second) is False
    assert metrics.counters["events_dropped_total"] == 1
