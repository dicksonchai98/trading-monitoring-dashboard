"""Serving API routes for external data access (REST + SSE)."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.config import (
    INDEX_CONTRIBUTION_CODE,
    OTC_SUMMARY_CODE,
    SERVING_HEARTBEAT_SECONDS,
    SERVING_POLL_INTERVAL_MS,
    SERVING_SSE_INCLUDE_QUOTE,
)
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
    fetch_kbar_daily_amplitude,
    fetch_kbar_history,
    fetch_kbar_today_range,
    fetch_market_summary_history,
    fetch_market_summary_latest,
    fetch_market_summary_today_range,
    fetch_metric_latest,
    fetch_metric_today_range,
    fetch_otc_summary_latest,
    fetch_otc_summary_today_range,
    fetch_quote_aggregates,
    fetch_quote_history,
    fetch_quote_latest,
    fetch_quote_today_range,
    fetch_spot_latest,
    fetch_spot_latest_list,
    fetch_spot_market_distribution_latest,
    fetch_spot_market_distribution_today_range,
    resolve_default_code,
    resolve_time_range,
)
from app.state import metrics, serving_rate_limiter
from app.utils.time import utcnow

router = APIRouter(prefix="/v1", tags=["serving"])
logger = logging.getLogger(__name__)


def _sse_message(event: str, data: dict[str, Any]) -> bytes:
    payload = json.dumps(data, ensure_ascii=True)
    return f"event: {event}\ndata: {payload}\n\n".encode()


def _require_code(code: str | None) -> str:
    normalized = (code or "").strip()
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="missing_code")
    return normalized


def _require_positive_days(days: int) -> int:
    if days <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_days")
    if days > 365:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="days_too_large")
    return days


def _resolve_otc_code(code: str | None) -> str:
    normalized = (code or "").strip()
    if normalized:
        return normalized
    return OTC_SUMMARY_CODE


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
    requested_code = _require_code(code)
    time_range = resolve_time_range(from_ms, to_ms, from_, to, default_kbar_window())
    try:
        data = fetch_kbar_today_range(requested_code, time_range)
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="kbar_not_found")
    return data


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


@router.get("/kbar/1m/daily-amplitude")
def kbar_daily_amplitude(
    code: str | None = None,
    n: int = 20,
    session=Depends(get_db_session),
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> list[dict[str, Any]]:
    metrics.inc("serving_rest_requests_total")
    requested_code = _require_code(code)
    requested_days = _require_positive_days(n)
    try:
        data = fetch_kbar_daily_amplitude(session, requested_code, requested_days)
    except Exception as err:
        metrics.inc("serving_db_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="db_unavailable"
        ) from err
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="kbar_not_found")
    return data


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
    requested_code = _require_code(code)
    time_range = resolve_time_range(from_ms, to_ms, from_, to, default_metric_window())
    try:
        data = fetch_metric_today_range(requested_code, time_range)
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="metric_not_found")
    return data


@router.get("/quote/latest")
def quote_latest(
    code: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> dict[str, Any]:
    metrics.inc("serving_rest_requests_total")
    try:
        data = fetch_quote_latest(resolve_default_code(code))
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="quote_not_found")
    return data


@router.get("/quote/today")
def quote_today(
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
        return fetch_quote_today_range(resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err


@router.get("/quote/history")
def quote_history(
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
    time_range = resolve_time_range(from_ms, to_ms, from_, to, default_metric_window())
    try:
        return fetch_quote_history(session, resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_db_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="db_unavailable"
        ) from err


@router.get("/quote/aggregates")
def quote_aggregates(
    code: str | None = None,
    from_: str | None = None,
    to: str | None = None,
    from_ms: int | None = None,
    to_ms: int | None = None,
    session=Depends(get_db_session),
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> dict[str, Any]:
    metrics.inc("serving_rest_requests_total")
    if not ((from_ms is not None and to_ms is not None) or (from_ and to)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="missing_range")
    time_range = resolve_time_range(from_ms, to_ms, from_, to, default_metric_window())
    try:
        return fetch_quote_aggregates(session, resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_db_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="db_unavailable"
        ) from err


@router.get("/market-summary/latest")
def market_summary_latest(
    code: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> dict[str, Any]:
    metrics.inc("serving_rest_requests_total")
    try:
        data = fetch_market_summary_latest(resolve_default_code(code))
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="market_summary_not_found"
        )
    return data


@router.get("/market-summary/today")
def market_summary_today(
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
        return fetch_market_summary_today_range(resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err


@router.get("/market-summary/history")
def market_summary_history(
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
        return fetch_market_summary_history(session, resolve_default_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_db_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="db_unavailable"
        ) from err


@router.get("/otc-summary/latest")
def otc_summary_latest(
    code: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> dict[str, Any]:
    metrics.inc("serving_rest_requests_total")
    try:
        data = fetch_otc_summary_latest(_resolve_otc_code(code))
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="otc_summary_not_found")
    return data


@router.get("/otc-summary/today")
def otc_summary_today(
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
        return fetch_otc_summary_today_range(_resolve_otc_code(code), time_range)
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err


@router.get("/spot/latest")
def spot_latest(
    symbol: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> dict[str, Any]:
    metrics.inc("serving_rest_requests_total")
    requested_symbol = _require_code(symbol)
    try:
        data = fetch_spot_latest(requested_symbol)
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="spot_not_found")
    return data


@router.get("/spot/market-distribution/latest")
def spot_market_distribution_latest(
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> dict[str, Any]:
    metrics.inc("serving_rest_requests_total")
    try:
        data = fetch_spot_market_distribution_latest()
    except Exception as err:
        metrics.inc("serving_redis_errors_total")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="redis_unavailable"
        ) from err
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="spot_market_distribution_not_found",
        )
    return data


@router.get("/spot/market-distribution/today")
def spot_market_distribution_today(
    from_ms: int | None = None,
    to_ms: int | None = None,
    from_: str | None = None,
    to: str | None = None,
    __: None = Depends(require_authenticated),
    ___: None = Depends(enforce_serving_rate_limit),
    ____: None = Depends(record_serving_latency),
) -> list[dict[str, Any]]:
    metrics.inc("serving_rest_requests_total")
    time_range = None
    if (from_ms is not None and to_ms is not None) or (from_ and to):
        time_range = resolve_time_range(from_ms, to_ms, from_, to, default_metric_window())
    try:
        return fetch_spot_market_distribution_today_range(time_range)
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
    instrument = _require_code(code)

    async def event_stream():
        last_kbar: dict[str, Any] | None = None
        last_metric: dict[str, Any] | None = None
        last_index_contrib_ranking: dict[str, Any] | None = None
        last_index_contrib_sector: dict[str, Any] | None = None
        last_heartbeat = 0.0
        last_quote: dict[str, Any] | None = None
        last_market_summary: dict[str, Any] | None = None
        last_otc_summary: dict[str, Any] | None = None
        last_heartbeat = asyncio.get_running_loop().time()
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
                    quote_latest_data = fetch_quote_latest(instrument)
                    market_summary_latest_data = fetch_market_summary_latest(instrument)
                    otc_summary_latest_data = fetch_otc_summary_latest(OTC_SUMMARY_CODE)
                except Exception:
                    metrics.inc("serving_redis_errors_total")
                    break
                try:
                    spot_latest_list_data = fetch_spot_latest_list()
                except Exception:
                    logger.exception("serving SSE spot latest list fetch failed")
                    metrics.inc("serving_redis_errors_total")
                    spot_latest_list_data = None
                try:
                    spot_market_distribution_latest_data = fetch_spot_market_distribution_latest()
                    spot_market_distribution_series_data = (
                        fetch_spot_market_distribution_today_range()
                    )
                except Exception:
                    logger.exception("serving SSE spot market distribution fetch failed")
                    metrics.inc("serving_redis_errors_total")
                    spot_market_distribution_latest_data = None
                    spot_market_distribution_series_data = None
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

                if (
                    SERVING_SSE_INCLUDE_QUOTE
                    and quote_latest_data
                    and quote_latest_data != last_quote
                ):
                    last_quote = quote_latest_data
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message("quote_latest", quote_latest_data)

                if market_summary_latest_data and market_summary_latest_data != last_market_summary:
                    last_market_summary = market_summary_latest_data
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message("market_summary_latest", market_summary_latest_data)

                if otc_summary_latest_data and otc_summary_latest_data != last_otc_summary:
                    last_otc_summary = otc_summary_latest_data
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message("otc_summary_latest", otc_summary_latest_data)

                if spot_latest_list_data:
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message("spot_latest_list", spot_latest_list_data)

                if spot_market_distribution_latest_data:
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message(
                        "spot_market_distribution_latest",
                        spot_market_distribution_latest_data,
                    )

                if spot_market_distribution_series_data:
                    metrics.inc("serving_sse_push_total")
                    yield _sse_message(
                        "spot_market_distribution_series",
                        {"items": spot_market_distribution_series_data},
                    )

                now = asyncio.get_running_loop().time()
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
