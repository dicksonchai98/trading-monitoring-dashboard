"""Serving API routes for external data access (REST + SSE)."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.config import INDEX_CONTRIBUTION_CODE, SERVING_HEARTBEAT_SECONDS, SERVING_POLL_INTERVAL_MS
from app.db.deps import get_db_session
from app.deps import (
    enforce_serving_rate_limit,
    record_serving_latency,
    require_authenticated,
    try_open_sse_slot,
)
from app.services.serving_store import (
    default_kbar_window,
    default_metric_window,
    fetch_current_kbar,
    fetch_index_contrib_ranking_latest,
    fetch_index_contrib_sector_latest,
    fetch_kbar_history,
    fetch_kbar_today_range,
    fetch_metric_latest,
    fetch_metric_today_range,
    resolve_default_code,
    resolve_time_range,
)
from app.state import metrics, serving_rate_limiter
from app.utils.time import utcnow

router = APIRouter(prefix="/v1", tags=["serving"])


def _sse_message(event: str, data: dict[str, Any]) -> bytes:
    payload = json.dumps(data, ensure_ascii=True)
    return f"event: {event}\ndata: {payload}\n\n".encode()


@router.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "time": utcnow().isoformat().replace("+00:00", "Z")}


@router.get("/kbar/1m/current")
def kbar_current(
    code: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> dict[str, Any]:
    metrics.inc("serving_rest_requests_total")
    try:
        data = fetch_current_kbar(resolve_default_code(code))

    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="kbar_not_found")
    return data


@router.get("/kbar/1m/today")
def kbar_today(
    code: str | None = None,
    from_ms: int | None = None,
    to_ms: int | None = None,
    from_: str | None = None,
    to: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> list[dict[str, Any]]:
    metrics.inc("serving_rest_requests_total")
    time_range = resolve_time_range(from_ms, to_ms, from_, to, default_kbar_window())
    try:
        return fetch_kbar_today_range(resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err


@router.get("/kbar/1m/history")
def kbar_history(
    code: str | None = None,
    from_: str | None = None,
    to: str | None = None,
    from_ms: int | None = None,
    to_ms: int | None = None,
    session=Depends(get_db_session),
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> list[dict[str, Any]]:
    metrics.inc("serving_rest_requests_total")
    if not ((from_ms is not None and to_ms is not None) or (from_ and to)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="missing_range")
    time_range = resolve_time_range(from_ms, to_ms, from_, to, default_kbar_window())
    try:
        return fetch_kbar_history(session, resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_db_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="db_unavailable"
        ) from err


@router.get("/kbar/1m/range")
def kbar_range(
    code: str | None = None,
    from_: str | None = None,
    to: str | None = None,
    from_ms: int | None = None,
    to_ms: int | None = None,
    session=Depends(get_db_session),
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> list[dict[str, Any]]:
    metrics.inc("serving_rest_requests_total")
    if not ((from_ms is not None and to_ms is not None) or (from_ and to)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="missing_range")
    time_range = resolve_time_range(from_ms, to_ms, from_, to, default_kbar_window())
    try:
        history = fetch_kbar_history(session, resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_db_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="db_unavailable"
        ) from err
    try:
        today = fetch_kbar_today_range(resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    merged = {item["minute_ts"]: item for item in history}
    for item in today:
        merged[item["minute_ts"]] = item
    return [merged[key] for key in sorted(merged.keys())]


@router.get("/metric/bidask/latest")
def bidask_latest(
    code: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> dict[str, Any]:
    metrics.inc("serving_rest_requests_total")
    try:
        data = fetch_metric_latest(resolve_default_code(code))
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="metric_not_found")
    return data


@router.get("/metric/bidask/today")
def bidask_today(
    code: str | None = None,
    from_ms: int | None = None,
    to_ms: int | None = None,
    from_: str | None = None,
    to: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> list[dict[str, Any]]:
    metrics.inc("serving_rest_requests_total")
    time_range = resolve_time_range(from_ms, to_ms, from_, to, default_metric_window())
    try:
        return fetch_metric_today_range(resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err


@router.get("/stream/sse")
async def stream_sse(
    request: Request,
    code: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
) -> StreamingResponse:
    key = try_open_sse_slot(request)
    metrics.set_gauge(
        "serving_sse_connections_active",
        metrics.counters.get("serving_sse_connections_active", 0) + 1,
    )
    instrument = resolve_default_code(code)

    async def event_stream():
        last_kbar: dict[str, Any] | None = None
        last_metric: dict[str, Any] | None = None
        last_index_contrib_ranking: dict[str, Any] | None = None
        last_index_contrib_sector: dict[str, Any] | None = None
        last_heartbeat = 0.0
        poll_interval = max(SERVING_POLL_INTERVAL_MS / 1000, 0.05)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    current_k = fetch_current_kbar(instrument)
                    metric_latest = fetch_metric_latest(instrument)
                    index_contrib_ranking = fetch_index_contrib_ranking_latest(
                        INDEX_CONTRIBUTION_CODE
                    )
                    index_contrib_sector = fetch_index_contrib_sector_latest(
                        INDEX_CONTRIBUTION_CODE
                    )
                except Exception:
                    metrics.inc("serving_redis_errors_total")
                    break
                now = asyncio.get_running_loop().time()

                if current_k and current_k != last_kbar:
                    last_kbar = current_k
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message("kbar_current", current_k)

                if metric_latest and metric_latest != last_metric:
                    last_metric = metric_latest
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message("metric_latest", metric_latest)

                if index_contrib_ranking and index_contrib_ranking != last_index_contrib_ranking:
                    last_index_contrib_ranking = index_contrib_ranking
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message(
                        "index_contrib_ranking",
                        {
                            **index_contrib_ranking,
                            "ts": int(now * 1000),
                        },
                    )

                if index_contrib_sector and index_contrib_sector != last_index_contrib_sector:
                    last_index_contrib_sector = index_contrib_sector
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message(
                        "index_contrib_sector",
                        {
                            **index_contrib_sector,
                            "ts": int(now * 1000),
                        },
                    )

                if now - last_heartbeat >= SERVING_HEARTBEAT_SECONDS:
                    last_heartbeat = now
                    yield _sse_message("heartbeat", {"ts": int(now * 1000)})

                await asyncio.sleep(poll_interval)
        finally:
            serving_rate_limiter.close_sse(key)
            metrics.set_gauge(
                "serving_sse_connections_active",
                max(metrics.counters.get("serving_sse_connections_active", 1) - 1, 0),
            )

    return StreamingResponse(event_stream(), media_type="text/event-stream")
