"""Serving data access helpers for Redis state and Postgres history."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from datetime import time as dt_time
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.config import (
    INGESTOR_CODE,
    INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT,
    INGESTOR_SPOT_SYMBOLS_FILE,
    SERVING_DEFAULT_CODE,
    SERVING_DEFAULT_KBAR_MINUTES,
    SERVING_DEFAULT_METRIC_SECONDS,
    SERVING_ENV,
)
from app.market_ingestion.spot_symbols import load_and_validate_spot_symbols
from app.models.kbar_1m import Kbar1mModel
from app.models.market_summary_1m import MarketSummary1mModel
from app.models.quote_feature_1m import QuoteFeature1mModel
from app.state import get_serving_redis_client
from app.stream_processing.runner import build_state_key, trade_date_for

TZ_TAIPEI = ZoneInfo("Asia/Taipei")
DAY_SESSION_START = dt_time(8, 45)
DAY_SESSION_END = dt_time(13, 45)
_DEFAULT_CODE_CACHE: dict[str, object] = {"code": None, "ts": 0.0}
_DEFAULT_CODE_TTL_SECONDS = 10.0
_SPOT_SYMBOLS_CACHE: dict[str, object] = {"symbols": None, "ts": 0.0}
_SPOT_SYMBOLS_TTL_SECONDS = 10.0


@dataclass(frozen=True)
class TimeRange:
    start: datetime
    end: datetime


def _parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TZ_TAIPEI)
    return parsed


def _to_epoch_ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def _from_epoch_ms(value: int) -> datetime:
    return datetime.fromtimestamp(value / 1000, tz=TZ_TAIPEI)


def resolve_time_range(
    from_ms: int | None,
    to_ms: int | None,
    from_iso: str | None,
    to_iso: str | None,
    default_window: timedelta,
) -> TimeRange:
    if from_ms is not None and to_ms is not None:
        return TimeRange(_from_epoch_ms(from_ms), _from_epoch_ms(to_ms))
    if from_iso and to_iso:
        return TimeRange(_parse_iso(from_iso), _parse_iso(to_iso))
    end = datetime.now(tz=TZ_TAIPEI)
    start = end - default_window
    return TimeRange(start, end)


def resolve_default_code(requested_code: str | None) -> str:
    if requested_code:
        return requested_code
    if SERVING_DEFAULT_CODE:
        return SERVING_DEFAULT_CODE
    discovered = _discover_code_from_streams()
    return discovered or INGESTOR_CODE


def _discover_code_from_streams() -> str | None:
    now = datetime.now(tz=TZ_TAIPEI).timestamp()
    cached_code = _DEFAULT_CODE_CACHE.get("code")
    cached_ts = _DEFAULT_CODE_CACHE.get("ts", 0.0)
    if cached_code and (now - float(cached_ts)) < _DEFAULT_CODE_TTL_SECONDS:
        return str(cached_code)
    redis_client = get_serving_redis_client()
    pattern = f"{SERVING_ENV}:stream:*:{INGESTOR_CODE}*"
    scan_iter = getattr(redis_client, "scan_iter", None)
    if not callable(scan_iter):
        return None
    for key in scan_iter(pattern):
        key_str = key.decode("utf-8") if isinstance(key, bytes) else str(key)
        if not _stream_has_entries(redis_client, key_str):
            continue
        entry = _latest_stream_entry(redis_client, key_str)
        if entry:
            _DEFAULT_CODE_CACHE["code"] = entry
            _DEFAULT_CODE_CACHE["ts"] = now
            return entry
    return None


def _stream_has_entries(redis_client: Any, key: str) -> bool:
    xlen = getattr(redis_client, "xlen", None)
    if callable(xlen):
        try:
            return int(xlen(key)) > 0
        except Exception:
            return False
    return True


def _latest_stream_entry(redis_client: Any, key: str) -> str | None:
    xrevrange = getattr(redis_client, "xrevrange", None)
    if not callable(xrevrange):
        return None
    try:
        entries = xrevrange(key, count=1)
    except Exception:
        return None
    if not entries:
        return None
    _entry_id, fields = entries[0]
    decoded = {
        (k.decode("utf-8") if isinstance(k, bytes) else str(k)): (
            v.decode("utf-8") if isinstance(v, bytes) else str(v)
        )
        for k, v in dict(fields).items()
    }
    code = decoded.get("code")
    if isinstance(code, str) and code.strip():
        return code.strip()
    return None


def normalize_kbar(record: dict[str, Any]) -> dict[str, Any]:
    def _to_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _to_optional_float(value: Any) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    minute_ts = _parse_iso(str(record.get("minute_ts")))
    return {
        "code": record.get("code"),
        "trade_date": record.get("trade_date"),
        "minute_ts": _to_epoch_ms(minute_ts),
        "open": _to_float(record.get("open", 0)),
        "high": _to_float(record.get("high", 0)),
        "low": _to_float(record.get("low", 0)),
        "close": _to_float(record.get("close", 0)),
        "volume": _to_float(record.get("volume", 0)),
        "amplitude": _to_float(record.get("amplitude", 0)),
        "amplitude_pct": _to_float(record.get("amplitude_pct", 0)),
        "day_amplitude": _to_optional_float(record.get("day_amplitude")),
    }


def normalize_metric_latest(payload: dict[str, Any]) -> dict[str, Any]:
    event_ts = payload.get("event_ts")
    ts_value = _to_epoch_ms(_parse_iso(str(event_ts))) if event_ts else None
    result = dict(payload)
    if ts_value is not None:
        result["ts"] = ts_value
    return result


def normalize_metric_sample(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    ts_value = payload.get("ts")
    if ts_value is not None:
        result["ts"] = int(ts_value) * 1000
    return result


def normalize_quote_latest(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    event_ts = payload.get("event_ts")
    if event_ts:
        result["ts"] = _to_epoch_ms(_parse_iso(str(event_ts)))
    return result


def normalize_quote_sample(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    event_ts = payload.get("event_ts")
    if event_ts:
        result["ts"] = _to_epoch_ms(_parse_iso(str(event_ts)))
    return result


def fetch_current_kbar(code: str) -> dict[str, Any] | None:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(datetime.now(tz=TZ_TAIPEI))
    key = build_state_key(SERVING_ENV, code, trade_date, "k:current")
    raw = redis_client.hgetall(key)
    if not raw:
        return None
    decoded = {
        (k.decode("utf-8") if isinstance(k, bytes) else str(k)): (
            v.decode("utf-8") if isinstance(v, bytes) else str(v)
        )
        for k, v in raw.items()
    }
    return normalize_kbar(decoded)


def fetch_kbar_today_range(code: str, time_range: TimeRange) -> list[dict[str, Any]]:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(time_range.end)
    key = build_state_key(SERVING_ENV, code, trade_date, "k:zset")
    start_score = int(time_range.start.timestamp())
    end_score = int(time_range.end.timestamp())
    entries = redis_client.zrangebyscore(key, start_score, end_score)
    result: list[dict[str, Any]] = []
    for entry in entries or []:
        payload = entry.decode("utf-8") if isinstance(entry, bytes) else str(entry)
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        result.append(normalize_kbar(data))
    return result


def fetch_kbar_history(session: Session, code: str, time_range: TimeRange) -> list[dict[str, Any]]:
    stmt = (
        select(Kbar1mModel)
        .where(Kbar1mModel.code == code)
        .where(Kbar1mModel.minute_ts >= time_range.start)
        .where(Kbar1mModel.minute_ts <= time_range.end)
        .order_by(Kbar1mModel.minute_ts.asc())
    )
    rows = session.execute(stmt).scalars().all()
    return [
        {
            "code": row.code,
            "trade_date": row.trade_date.isoformat(),
            "minute_ts": _to_epoch_ms(row.minute_ts),
            "open": row.open,
            "high": row.high,
            "low": row.low,
            "close": row.close,
            "volume": row.volume,
            "amplitude": row.amplitude if row.amplitude is not None else 0.0,
            "amplitude_pct": row.amplitude_pct if row.amplitude_pct is not None else 0.0,
        }
        for row in rows
    ]


def fetch_kbar_daily_amplitude(session: Session, code: str, days: int) -> list[dict[str, Any]]:
    today = datetime.now(tz=TZ_TAIPEI).date()
    trade_dates_stmt = (
        select(Kbar1mModel.trade_date)
        .where(Kbar1mModel.code == code)
        .where(Kbar1mModel.trade_date < today)
        .group_by(Kbar1mModel.trade_date)
        .order_by(Kbar1mModel.trade_date.desc())
        .limit(days)
    )
    trade_dates = [row[0] for row in session.execute(trade_dates_stmt).all()]
    if not trade_dates:
        return []

    rows_stmt = (
        select(
            Kbar1mModel.trade_date,
            Kbar1mModel.minute_ts,
            Kbar1mModel.open,
            Kbar1mModel.high,
            Kbar1mModel.low,
            Kbar1mModel.close,
        )
        .where(Kbar1mModel.code == code)
        .where(Kbar1mModel.trade_date.in_(trade_dates))
        .order_by(Kbar1mModel.trade_date.desc(), Kbar1mModel.minute_ts.asc())
    )
    rows = session.execute(rows_stmt).all()
    by_date: dict[Any, list[Any]] = {}
    for row in rows:
        minute_ts = row.minute_ts
        if minute_ts.tzinfo is None:
            minute_ts = minute_ts.replace(tzinfo=TZ_TAIPEI)
        local_time = minute_ts.astimezone(TZ_TAIPEI).time()
        if local_time < DAY_SESSION_START or local_time > DAY_SESSION_END:
            continue
        by_date.setdefault(row.trade_date, []).append(row)

    result: list[dict[str, Any]] = []
    for trade_date in trade_dates:
        day_rows = by_date.get(trade_date, [])
        if not day_rows:
            continue
        day_open = float(day_rows[0].open)
        day_close = float(day_rows[-1].close)
        day_high = max(float(row.high) for row in day_rows)
        day_low = min(float(row.low) for row in day_rows)
        result.append(
            {
                "code": code,
                "trade_date": trade_date.isoformat(),
                "open": day_open,
                "high": day_high,
                "low": day_low,
                "close": day_close,
                "day_amplitude": day_high - day_low,
            }
        )
    return result


def fetch_metric_latest(code: str) -> dict[str, Any] | None:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(datetime.now(tz=TZ_TAIPEI))
    key = build_state_key(SERVING_ENV, code, trade_date, "metrics:latest")
    raw = redis_client.get(key)
    if raw is None:
        return None
    payload = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return normalize_metric_latest(data)


def fetch_metric_today_range(code: str, time_range: TimeRange) -> list[dict[str, Any]]:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(time_range.end)
    key = build_state_key(SERVING_ENV, code, trade_date, "metrics:zset")
    start_score = int(time_range.start.timestamp())
    end_score = int(time_range.end.timestamp())
    entries = redis_client.zrangebyscore(key, start_score, end_score)
    result: list[dict[str, Any]] = []
    for entry in entries or []:
        payload = entry.decode("utf-8") if isinstance(entry, bytes) else str(entry)
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        result.append(normalize_metric_sample(data))
    return result


def fetch_quote_latest(code: str) -> dict[str, Any] | None:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(datetime.now(tz=TZ_TAIPEI))
    key = build_state_key(SERVING_ENV, code, trade_date, "quote_features:latest")
    raw = redis_client.get(key)
    if raw is None:
        return None
    payload = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return normalize_quote_latest(data)


def fetch_quote_today_range(code: str, time_range: TimeRange) -> list[dict[str, Any]]:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(time_range.end)
    key = build_state_key(SERVING_ENV, code, trade_date, "quote_features:zset")
    start_score = int(time_range.start.timestamp())
    end_score = int(time_range.end.timestamp())
    entries = redis_client.zrangebyscore(key, start_score, end_score)
    result: list[dict[str, Any]] = []
    for entry in entries or []:
        payload = entry.decode("utf-8") if isinstance(entry, bytes) else str(entry)
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        result.append(normalize_quote_sample(data))
    return result


def fetch_quote_history(session: Session, code: str, time_range: TimeRange) -> list[dict[str, Any]]:
    stmt = (
        select(QuoteFeature1mModel)
        .where(QuoteFeature1mModel.code == code)
        .where(QuoteFeature1mModel.minute_ts >= time_range.start)
        .where(QuoteFeature1mModel.minute_ts <= time_range.end)
        .order_by(QuoteFeature1mModel.minute_ts.asc())
    )
    rows = session.execute(stmt).scalars().all()
    return [
        {
            "code": row.code,
            "trade_date": row.trade_date.isoformat(),
            "minute_ts": _to_epoch_ms(row.minute_ts),
            "main_chip": row.main_chip,
            "main_chip_day_high": row.main_chip_day_high,
            "main_chip_day_low": row.main_chip_day_low,
            "main_chip_strength": row.main_chip_strength,
            "long_short_force": row.long_short_force,
            "long_short_force_day_high": row.long_short_force_day_high,
            "long_short_force_day_low": row.long_short_force_day_low,
            "long_short_force_strength": row.long_short_force_strength,
        }
        for row in rows
    ]


def fetch_quote_aggregates(session: Session, code: str, time_range: TimeRange) -> dict[str, Any]:
    rows = fetch_quote_history(session, code, time_range)
    if not rows:
        return {
            "code": code,
            "count": 0,
            "main_chip": {"min": None, "max": None, "avg": None, "last": None},
            "long_short_force": {"min": None, "max": None, "avg": None, "last": None},
        }
    main = [float(item["main_chip"]) for item in rows]
    force = [float(item["long_short_force"]) for item in rows]
    return {
        "code": code,
        "count": len(rows),
        "main_chip": {
            "min": min(main),
            "max": max(main),
            "avg": sum(main) / len(main),
            "last": main[-1],
        },
        "long_short_force": {
            "min": min(force),
            "max": max(force),
            "avg": sum(force) / len(force),
            "last": force[-1],
        },
    }


def normalize_market_summary_latest(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    event_ts = payload.get("event_ts")
    if event_ts:
        result["event_ts"] = _to_epoch_ms(_parse_iso(str(event_ts)))
    minute_ts = payload.get("minute_ts")
    if minute_ts:
        result["minute_ts"] = _to_epoch_ms(_parse_iso(str(minute_ts)))
    return result


def normalize_otc_summary_latest(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    event_ts = payload.get("event_ts")
    if event_ts:
        result["event_ts"] = _to_epoch_ms(_parse_iso(str(event_ts)))
    minute_ts = payload.get("minute_ts")
    if minute_ts:
        result["minute_ts"] = _to_epoch_ms(_parse_iso(str(minute_ts)))
    return result


def normalize_spot_latest(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    updated_at = payload.get("updated_at")
    if updated_at:
        result["updated_at"] = _to_epoch_ms(_parse_iso(str(updated_at)))
    return result


def _load_spot_symbols() -> list[str]:
    now = datetime.now(tz=TZ_TAIPEI).timestamp()
    cached_symbols = _SPOT_SYMBOLS_CACHE.get("symbols")
    cached_ts = float(_SPOT_SYMBOLS_CACHE.get("ts", 0.0))
    if isinstance(cached_symbols, list) and (now - cached_ts) < _SPOT_SYMBOLS_TTL_SECONDS:
        return [str(item) for item in cached_symbols]
    symbols = load_and_validate_spot_symbols(
        path=INGESTOR_SPOT_SYMBOLS_FILE,
        expected_count=INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT,
    )
    _SPOT_SYMBOLS_CACHE["symbols"] = symbols
    _SPOT_SYMBOLS_CACHE["ts"] = now
    return symbols


def fetch_spot_latest(symbol: str) -> dict[str, Any] | None:
    redis_client = get_serving_redis_client()
    key = f"{SERVING_ENV}:state:spot:{symbol}:latest"
    raw = redis_client.get(key)
    if raw is None:
        return None
    payload = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return normalize_spot_latest(data)


def fetch_spot_latest_list() -> dict[str, Any]:
    symbols = _load_spot_symbols()
    items: list[dict[str, Any]] = []
    strength_score_sum = 0.0
    strength_score_count = 0
    strength_counts = {
        "new_high": 0,
        "strong_up": 0,
        "flat": 0,
        "strong_down": 0,
        "new_low": 0,
    }
    for symbol in symbols:
        payload = fetch_spot_latest(symbol)
        if payload is None:
            items.append(
                {
                    "symbol": symbol,
                    "open": None,
                    "high": None,
                    "low": None,
                    "close": None,
                    "last_price": None,
                    "session_high": None,
                    "session_low": None,
                    "reference_price": None,
                    "price_chg": None,
                    "pct_chg": None,
                    "gap_value": None,
                    "gap_pct": None,
                    "is_gap_up": None,
                    "is_gap_down": None,
                    "is_new_high": None,
                    "is_new_low": None,
                    "strength_state": None,
                    "strength_score": None,
                    "updated_at": None,
                }
            )
            continue
        strength_state = payload.get("strength_state")
        strength_score = payload.get("strength_score")
        if isinstance(strength_state, str) and strength_state in strength_counts:
            strength_counts[strength_state] += 1
        if isinstance(strength_score, (int, float)):
            strength_score_sum += float(strength_score)
            strength_score_count += 1
        items.append(
            {
                "symbol": payload.get("symbol", symbol),
                "open": payload.get("open"),
                "high": payload.get("high"),
                "low": payload.get("low"),
                "close": payload.get("close"),
                "last_price": payload.get("last_price"),
                "session_high": payload.get("session_high"),
                "session_low": payload.get("session_low"),
                "reference_price": payload.get("reference_price"),
                "price_chg": payload.get("price_chg"),
                "pct_chg": payload.get("pct_chg"),
                "gap_value": payload.get("gap_value"),
                "gap_pct": payload.get("gap_pct"),
                "is_gap_up": payload.get("is_gap_up"),
                "is_gap_down": payload.get("is_gap_down"),
                "is_new_high": payload.get("is_new_high"),
                "is_new_low": payload.get("is_new_low"),
                "strength_state": strength_state,
                "strength_score": strength_score,
                "updated_at": payload.get("updated_at"),
            }
        )
    market_strength_score = (
        round(strength_score_sum / strength_score_count, 3) if strength_score_count > 0 else None
    )
    market_strength_pct = (
        round((market_strength_score / 2.0) * 100, 2) if market_strength_score is not None else None
    )
    return {
        "ts": int(datetime.now(tz=TZ_TAIPEI).timestamp() * 1000),
        "items": items,
        "market_strength_score": market_strength_score,
        "market_strength_pct": market_strength_pct,
        "market_strength_count": strength_score_count,
        "market_strength_breakdown": strength_counts,
    }


def fetch_market_summary_latest(code: str) -> dict[str, Any] | None:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(datetime.now(tz=TZ_TAIPEI))
    key = build_state_key(SERVING_ENV, code, trade_date, "market_summary:latest")
    raw = redis_client.get(key)
    if raw is None:
        return None
    payload = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return normalize_market_summary_latest(data)


def fetch_market_summary_today_range(code: str, time_range: TimeRange) -> list[dict[str, Any]]:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(time_range.end)
    key = build_state_key(SERVING_ENV, code, trade_date, "market_summary:zset")
    start_score = int(time_range.start.timestamp())
    end_score = int(time_range.end.timestamp())
    entries = redis_client.zrangebyscore(key, start_score, end_score)
    result: list[dict[str, Any]] = []
    for entry in entries or []:
        payload = entry.decode("utf-8") if isinstance(entry, bytes) else str(entry)
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        result.append(normalize_market_summary_latest(data))
    return result


def fetch_market_summary_history(
    session: Session, code: str, time_range: TimeRange
) -> list[dict[str, Any]]:
    stmt = (
        select(MarketSummary1mModel)
        .where(MarketSummary1mModel.market_code == code)
        .where(MarketSummary1mModel.minute_ts >= time_range.start)
        .where(MarketSummary1mModel.minute_ts <= time_range.end)
        .order_by(MarketSummary1mModel.minute_ts.asc())
    )
    rows = session.execute(stmt).scalars().all()
    return [
        {
            "code": row.market_code,
            "trade_date": row.trade_date.isoformat(),
            "minute_ts": _to_epoch_ms(row.minute_ts),
            "index_value": row.index_value,
            "cumulative_turnover": row.cumulative_turnover,
            "completion_ratio": row.completion_ratio,
            "estimated_turnover": row.estimated_turnover,
            "yesterday_estimated_turnover": row.yesterday_estimated_turnover,
            "estimated_turnover_diff": row.estimated_turnover_diff,
            "estimated_turnover_ratio": row.estimated_turnover_ratio,
            "futures_code": row.futures_code,
            "futures_price": row.futures_price,
            "spread": row.spread,
            "spread_day_high": row.spread_day_high,
            "spread_day_low": row.spread_day_low,
            "spread_strength": row.spread_strength,
            "spread_status": row.spread_status,
        }
        for row in rows
    ]


def fetch_otc_summary_latest(code: str) -> dict[str, Any] | None:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(datetime.now(tz=TZ_TAIPEI))
    key = build_state_key(SERVING_ENV, code, trade_date, "otc_summary:latest")
    raw = redis_client.get(key)
    if raw is None:
        return None
    payload = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return normalize_otc_summary_latest(data)


def fetch_otc_summary_today_range(code: str, time_range: TimeRange) -> list[dict[str, Any]]:
    redis_client = get_serving_redis_client()
    trade_date = trade_date_for(time_range.end)
    key = build_state_key(SERVING_ENV, code, trade_date, "otc_summary:zset")
    start_score = int(time_range.start.timestamp())
    end_score = int(time_range.end.timestamp())
    entries = redis_client.zrangebyscore(key, start_score, end_score)
    result: list[dict[str, Any]] = []
    for entry in entries or []:
        payload = entry.decode("utf-8") if isinstance(entry, bytes) else str(entry)
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        result.append(normalize_otc_summary_latest(data))
    return result


def default_kbar_window() -> timedelta:
    return timedelta(minutes=SERVING_DEFAULT_KBAR_MINUTES)


def default_metric_window() -> timedelta:
    return timedelta(seconds=SERVING_DEFAULT_METRIC_SECONDS)
