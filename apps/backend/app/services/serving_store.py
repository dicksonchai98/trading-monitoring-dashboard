"""Serving data access helpers for Redis state and Postgres history."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from app.config import (
    INGESTOR_CODE,
    SERVING_DEFAULT_CODE,
    SERVING_DEFAULT_KBAR_MINUTES,
    SERVING_DEFAULT_METRIC_SECONDS,
    SERVING_ENV,
)
from app.models.kbar_1m import Kbar1mModel
from app.models.quote_feature_1m import QuoteFeature1mModel
from app.state import get_serving_redis_client
from app.stream_processing.runner import build_state_key, trade_date_for

TZ_TAIPEI = ZoneInfo("Asia/Taipei")
_DEFAULT_CODE_CACHE: dict[str, object] = {"code": None, "ts": 0.0}
_DEFAULT_CODE_TTL_SECONDS = 10.0


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
    minute_ts = _parse_iso(str(record.get("minute_ts")))
    return {
        "code": record.get("code"),
        "trade_date": record.get("trade_date"),
        "minute_ts": _to_epoch_ms(minute_ts),
        "open": float(record.get("open", 0)),
        "high": float(record.get("high", 0)),
        "low": float(record.get("low", 0)),
        "close": float(record.get("close", 0)),
        "volume": float(record.get("volume", 0)),
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
        }
        for row in rows
    ]


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


def default_kbar_window() -> timedelta:
    return timedelta(minutes=SERVING_DEFAULT_KBAR_MINUTES)


def default_metric_window() -> timedelta:
    return timedelta(seconds=SERVING_DEFAULT_METRIC_SECONDS)
