"""Core compute/query service for k-bar analytics."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from statistics import median
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.config import KBAR_ANALYTICS_RETRY_BACKOFF_SECONDS, KBAR_ANALYTICS_RETRY_MAX_ATTEMPTS
from app.models.analytics_job import AnalyticsJobModel
from app.models.kbar_1m import Kbar1mModel
from app.models.kbar_daily_feature import KbarDailyFeatureModel
from app.models.kbar_distribution_stat import KbarDistributionStatModel
from app.models.kbar_event_sample import KbarEventSampleModel
from app.models.kbar_event_stat import KbarEventStatModel
from app.modules.batch_shared.retry.errors import ErrorCategory
from app.modules.batch_shared.retry.policy import RetryPolicy
from app.modules.kbar_analytics.registry import (
    EVENT_REGISTRY,
    METRIC_REGISTRY,
    ensure_event_exists,
    ensure_metric_exists,
    evaluate_event,
)


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def _compute_histogram(values: list[float], bins: int = 20) -> dict[str, Any]:
    if not values:
        return {"bins": [], "counts": [], "min": 0.0, "max": 0.0, "bucket_size": 0.0}
    min_v = min(values)
    max_v = max(values)
    if min_v == max_v:
        return {
            "bins": [min_v, max_v],
            "counts": [len(values)],
            "min": min_v,
            "max": max_v,
            "bucket_size": 0.0,
        }
    bucket_size = (max_v - min_v) / bins
    edges = [min_v + bucket_size * i for i in range(bins + 1)]
    counts = [0 for _ in range(bins)]
    for value in values:
        idx = int((value - min_v) / bucket_size)
        if idx >= bins:
            idx = bins - 1
        counts[idx] += 1
    return {
        "bins": edges,
        "counts": counts,
        "min": min_v,
        "max": max_v,
        "bucket_size": bucket_size,
    }


def _percentile(values: list[float], percentile_value: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * percentile_value
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    weight = position - low
    return ordered[low] * (1 - weight) + ordered[high] * weight


def _next_version(
    session: Session,
    model,
    *filters,
) -> int:
    stmt = select(func.max(model.version)).where(*filters)
    current = session.execute(stmt).scalar_one_or_none()
    return (int(current) if current is not None else 0) + 1


@dataclass
class KbarAnalyticsService:
    session: Session

    def list_events(self) -> list[dict[str, Any]]:
        return [
            {"event_id": event_id, **definition} for event_id, definition in EVENT_REGISTRY.items()
        ]

    def list_metrics(self) -> list[dict[str, str]]:
        return [{"metric_id": metric_id} for metric_id in METRIC_REGISTRY]

    def rebuild_daily_features(
        self,
        *,
        code: str | None,
        start_date: date | None,
        end_date: date | None,
    ) -> dict[str, int]:
        stmt: Select[tuple[Kbar1mModel]] = select(Kbar1mModel).order_by(
            Kbar1mModel.code, Kbar1mModel.trade_date, Kbar1mModel.minute_ts
        )
        if code:
            stmt = stmt.where(Kbar1mModel.code == code)
        if start_date:
            stmt = stmt.where(Kbar1mModel.trade_date >= start_date)
        if end_date:
            stmt = stmt.where(Kbar1mModel.trade_date <= end_date)

        rows = list(self.session.execute(stmt).scalars())
        grouped: dict[tuple[str, date], list[Kbar1mModel]] = {}
        for row in rows:
            grouped.setdefault((row.code, row.trade_date), []).append(row)

        created_or_updated = 0
        previous_close_by_code: dict[str, float] = {}
        features = sorted(grouped.items(), key=lambda item: (item[0][0], item[0][1]))
        for (row_code, trade_date_value), bars in features:
            bars.sort(key=lambda item: item.minute_ts)
            day_open = float(bars[0].open)
            day_close = float(bars[-1].close)
            day_high = max(float(item.high) for item in bars)
            day_low = min(float(item.low) for item in bars)
            day_volume = float(sum(float(item.volume) for item in bars))
            day_return = day_close - day_open
            day_range = day_high - day_low
            day_return_pct = _safe_ratio(day_return, day_open)
            day_range_pct = _safe_ratio(day_range, day_open)
            prev_close = previous_close_by_code.get(row_code, day_open)
            gap = day_open - prev_close
            close_position = 0.5 if day_range == 0 else _safe_ratio(day_close - day_low, day_range)

            entity = self.session.get(
                KbarDailyFeatureModel, {"code": row_code, "trade_date": trade_date_value}
            )
            if entity is None:
                entity = KbarDailyFeatureModel(code=row_code, trade_date=trade_date_value)
                self.session.add(entity)
            entity.day_open = day_open
            entity.day_high = day_high
            entity.day_low = day_low
            entity.day_close = day_close
            entity.day_volume = day_volume
            entity.day_return = day_return
            entity.day_range = day_range
            entity.day_return_pct = day_return_pct
            entity.day_range_pct = day_range_pct
            entity.gap_from_prev_close = gap
            entity.close_position = close_position
            created_or_updated += 1
            previous_close_by_code[row_code] = day_close

        self.session.flush()
        return {"rows": created_or_updated}

    def recompute_event_stats(
        self,
        *,
        code: str,
        start_date: date,
        end_date: date,
        event_ids: list[str] | None,
    ) -> dict[str, int]:
        events = event_ids or list(EVENT_REGISTRY.keys())
        for event_id in events:
            ensure_event_exists(event_id)

        feature_rows = list(
            self.session.execute(
                select(KbarDailyFeatureModel)
                .where(KbarDailyFeatureModel.code == code)
                .where(KbarDailyFeatureModel.trade_date >= start_date)
                .where(KbarDailyFeatureModel.trade_date <= end_date)
                .order_by(KbarDailyFeatureModel.trade_date)
            ).scalars()
        )

        created_samples = 0
        for idx in range(len(feature_rows) - 1):
            feature = feature_rows[idx]
            next_feature = feature_rows[idx + 1]
            feature_data = {
                "day_return": feature.day_return,
                "day_range": feature.day_range,
                "close_position": feature.close_position,
                "gap_from_prev_close": feature.gap_from_prev_close,
            }
            for event_id in events:
                matched, event_value = evaluate_event(event_id, feature_data)
                if not matched:
                    continue
                next_return = next_feature.day_return
                category = "flat"
                if next_return > 0:
                    category = "up"
                elif next_return < 0:
                    category = "down"
                sample = self.session.get(
                    KbarEventSampleModel,
                    {
                        "event_id": event_id,
                        "code": code,
                        "trade_date": feature.trade_date,
                    },
                )
                if sample is None:
                    sample = KbarEventSampleModel(
                        event_id=event_id,
                        code=code,
                        trade_date=feature.trade_date,
                        next_trade_date=next_feature.trade_date,
                        event_value=event_value,
                        event_day_return=feature.day_return,
                        event_day_range=feature.day_range,
                        next_day_open=next_feature.day_open,
                        next_day_high=next_feature.day_high,
                        next_day_low=next_feature.day_low,
                        next_day_close=next_feature.day_close,
                        next_day_return=next_feature.day_return,
                        next_day_range=next_feature.day_range,
                        next_day_gap=next_feature.gap_from_prev_close,
                        next_day_category=category,
                    )
                    self.session.add(sample)
                    created_samples += 1
                else:
                    sample.next_trade_date = next_feature.trade_date
                    sample.event_value = event_value
                    sample.event_day_return = feature.day_return
                    sample.event_day_range = feature.day_range
                    sample.next_day_open = next_feature.day_open
                    sample.next_day_high = next_feature.day_high
                    sample.next_day_low = next_feature.day_low
                    sample.next_day_close = next_feature.day_close
                    sample.next_day_return = next_feature.day_return
                    sample.next_day_range = next_feature.day_range
                    sample.next_day_gap = next_feature.gap_from_prev_close
                    sample.next_day_category = category
                    sample.computed_at = _utcnow()

        generated_stats = 0
        for event_id in events:
            matched_rows = list(
                self.session.execute(
                    select(KbarEventSampleModel)
                    .where(KbarEventSampleModel.event_id == event_id)
                    .where(KbarEventSampleModel.code == code)
                    .where(KbarEventSampleModel.trade_date >= start_date)
                    .where(KbarEventSampleModel.trade_date <= end_date)
                ).scalars()
            )
            if not matched_rows:
                continue

            next_returns = [row.next_day_return for row in matched_rows]
            next_ranges = [row.next_day_range for row in matched_rows]
            next_gaps = [row.next_day_gap for row in matched_rows]
            up_count = sum(1 for row in matched_rows if row.next_day_category == "up")
            down_count = sum(1 for row in matched_rows if row.next_day_category == "down")
            flat_count = sum(1 for row in matched_rows if row.next_day_category == "flat")
            sample_count = len(matched_rows)

            version = _next_version(
                self.session,
                KbarEventStatModel,
                KbarEventStatModel.event_id == event_id,
                KbarEventStatModel.code == code,
                KbarEventStatModel.start_date == start_date,
                KbarEventStatModel.end_date == end_date,
            )
            stat = KbarEventStatModel(
                event_id=event_id,
                code=code,
                start_date=start_date,
                end_date=end_date,
                sample_count=sample_count,
                up_count=up_count,
                down_count=down_count,
                flat_count=flat_count,
                up_probability=_safe_ratio(up_count, sample_count),
                down_probability=_safe_ratio(down_count, sample_count),
                flat_probability=_safe_ratio(flat_count, sample_count),
                avg_next_day_return=sum(next_returns) / sample_count,
                median_next_day_return=float(median(next_returns)),
                avg_next_day_range=sum(next_ranges) / sample_count,
                avg_next_day_gap=sum(next_gaps) / sample_count,
                version=version,
            )
            self.session.add(stat)
            generated_stats += 1

        self.session.flush()
        return {"samples": created_samples, "stats": generated_stats}

    def recompute_distribution_stats(
        self,
        *,
        code: str,
        start_date: date | None,
        end_date: date | None,
        metric_ids: list[str] | None,
    ) -> dict[str, int]:
        metrics = metric_ids or METRIC_REGISTRY
        for metric_id in metrics:
            ensure_metric_exists(metric_id)

        feature_stmt = select(KbarDailyFeatureModel).where(KbarDailyFeatureModel.code == code)
        if start_date is not None:
            feature_stmt = feature_stmt.where(KbarDailyFeatureModel.trade_date >= start_date)
        if end_date is not None:
            feature_stmt = feature_stmt.where(KbarDailyFeatureModel.trade_date <= end_date)
        features = list(self.session.execute(feature_stmt).scalars())
        if not features:
            self.session.flush()
            return {"stats": 0}

        effective_start_date = min(item.trade_date for item in features)
        effective_end_date = max(item.trade_date for item in features)

        generated = 0
        for metric_id in metrics:
            values = [float(getattr(item, metric_id)) for item in features]
            if not values:
                continue
            version = _next_version(
                self.session,
                KbarDistributionStatModel,
                KbarDistributionStatModel.metric_id == metric_id,
                KbarDistributionStatModel.code == code,
                KbarDistributionStatModel.start_date == effective_start_date,
                KbarDistributionStatModel.end_date == effective_end_date,
            )
            values_sorted = sorted(values)
            stat = KbarDistributionStatModel(
                metric_id=metric_id,
                code=code,
                start_date=effective_start_date,
                end_date=effective_end_date,
                sample_count=len(values),
                mean=sum(values) / len(values),
                median=float(median(values)),
                min=min(values),
                max=max(values),
                p25=_percentile(values_sorted, 0.25),
                p50=_percentile(values_sorted, 0.50),
                p75=_percentile(values_sorted, 0.75),
                p90=_percentile(values_sorted, 0.90),
                p95=_percentile(values_sorted, 0.95),
                histogram_json=_compute_histogram(values_sorted, bins=20),
                version=version,
            )
            self.session.add(stat)
            generated += 1

        self.session.flush()
        return {"stats": generated}

    def get_event_stats(
        self,
        *,
        event_id: str,
        code: str,
        start_date: date,
        end_date: date,
        version: int | None,
    ) -> KbarEventStatModel | None:
        ensure_event_exists(event_id)
        stmt = (
            select(KbarEventStatModel)
            .where(KbarEventStatModel.event_id == event_id)
            .where(KbarEventStatModel.code == code)
            .where(KbarEventStatModel.start_date == start_date)
            .where(KbarEventStatModel.end_date == end_date)
        )
        if version is not None:
            stmt = stmt.where(KbarEventStatModel.version == version)
        else:
            stmt = stmt.order_by(KbarEventStatModel.version.desc()).limit(1)
        return self.session.execute(stmt).scalar_one_or_none()

    def get_latest_event_stats_by_code(self, *, code: str) -> list[KbarEventStatModel]:
        rows = list(
            self.session.execute(
                select(KbarEventStatModel)
                .where(KbarEventStatModel.code == code)
                .order_by(
                    KbarEventStatModel.event_id.asc(),
                    KbarEventStatModel.end_date.desc(),
                    KbarEventStatModel.version.desc(),
                )
            ).scalars()
        )

        latest_by_event: dict[str, KbarEventStatModel] = {}
        for row in rows:
            if row.event_id not in latest_by_event:
                latest_by_event[row.event_id] = row

        return sorted(latest_by_event.values(), key=lambda item: item.event_id)

    def get_event_samples(
        self,
        *,
        event_id: str,
        code: str,
        start_date: date,
        end_date: date,
        page: int,
        page_size: int,
        sort: str,
    ) -> tuple[list[KbarEventSampleModel], int]:
        ensure_event_exists(event_id)
        base_stmt = (
            select(KbarEventSampleModel)
            .where(KbarEventSampleModel.event_id == event_id)
            .where(KbarEventSampleModel.code == code)
            .where(KbarEventSampleModel.trade_date >= start_date)
            .where(KbarEventSampleModel.trade_date <= end_date)
        )
        count_stmt = (
            select(func.count())
            .select_from(KbarEventSampleModel)
            .where(
                KbarEventSampleModel.event_id == event_id,
                KbarEventSampleModel.code == code,
                KbarEventSampleModel.trade_date >= start_date,
                KbarEventSampleModel.trade_date <= end_date,
            )
        )

        if sort == "-trade_date":
            base_stmt = base_stmt.order_by(KbarEventSampleModel.trade_date.desc())
        else:
            base_stmt = base_stmt.order_by(KbarEventSampleModel.trade_date.asc())

        offset = (page - 1) * page_size
        items = list(self.session.execute(base_stmt.offset(offset).limit(page_size)).scalars())
        total = int(self.session.execute(count_stmt).scalar_one())
        return items, total

    def get_distribution_stats(
        self,
        *,
        metric_id: str,
        code: str,
        start_date: date | None,
        end_date: date | None,
        version: int | None,
    ) -> KbarDistributionStatModel | None:
        ensure_metric_exists(metric_id)
        stmt = (
            select(KbarDistributionStatModel)
            .where(KbarDistributionStatModel.metric_id == metric_id)
            .where(KbarDistributionStatModel.code == code)
        )
        if start_date is not None:
            stmt = stmt.where(KbarDistributionStatModel.start_date == start_date)
        if end_date is not None:
            stmt = stmt.where(KbarDistributionStatModel.end_date == end_date)
        if version is not None:
            stmt = stmt.where(KbarDistributionStatModel.version == version)
        stmt = stmt.order_by(
            KbarDistributionStatModel.computed_at.desc(),
            KbarDistributionStatModel.version.desc(),
        ).limit(1)
        return self.session.execute(stmt).scalar_one_or_none()

    def create_job(self, *, job_type: str, payload: dict[str, Any]) -> AnalyticsJobModel:
        job = AnalyticsJobModel(job_type=job_type, payload=payload, status="pending", retry_count=0)
        self.session.add(job)
        self.session.flush()
        return job

    def mark_job_running(self, job: AnalyticsJobModel) -> None:
        job.status = "running"
        if job.started_at is None:
            job.started_at = _utcnow()
        self.session.flush()

    def mark_job_retrying(
        self, job: AnalyticsJobModel, *, attempt: int, category: ErrorCategory
    ) -> None:
        job.status = "running"
        job.retry_count = attempt
        job.error_message = f"retry_{category.value}"
        self.session.flush()

    def mark_job_success(self, job: AnalyticsJobModel) -> None:
        job.status = "success"
        job.finished_at = _utcnow()
        self.session.flush()

    def mark_job_failed(self, job: AnalyticsJobModel, *, error_message: str) -> None:
        job.status = "failed"
        job.error_message = error_message
        job.finished_at = _utcnow()
        self.session.flush()

    def execute_job_with_retry(
        self,
        *,
        job: AnalyticsJobModel,
        operation,
        max_attempts: int = KBAR_ANALYTICS_RETRY_MAX_ATTEMPTS,
        backoff_seconds: int = KBAR_ANALYTICS_RETRY_BACKOFF_SECONDS,
    ) -> dict[str, int]:
        retry_policy = RetryPolicy(
            max_attempts=max(1, max_attempts), backoff_seconds=max(0, backoff_seconds)
        )

        def _operation() -> dict[str, int]:
            self.mark_job_running(job)
            return operation()

        def _on_retry(attempt: int, category: ErrorCategory) -> None:
            self.mark_job_retrying(job, attempt=attempt, category=category)

        try:
            result = retry_policy.run(_operation, _on_retry)
            self.mark_job_success(job)
            return result
        except Exception as err:
            self.mark_job_failed(job, error_message=str(err))
            raise

    def run_daily_pipeline(
        self,
        *,
        code: str,
        start_date: date,
        end_date: date,
    ) -> dict[str, dict[str, int] | int]:
        rebuilt_job = self.create_job(
            job_type="rebuild_daily_features",
            payload={
                "code": code,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )
        rebuilt_result = self.execute_job_with_retry(
            job=rebuilt_job,
            operation=lambda: self.rebuild_daily_features(
                code=code,
                start_date=start_date,
                end_date=end_date,
            ),
        )

        event_job = self.create_job(
            job_type="recompute_event_stats",
            payload={
                "code": code,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )
        event_result = self.execute_job_with_retry(
            job=event_job,
            operation=lambda: self.recompute_event_stats(
                code=code,
                start_date=start_date,
                end_date=end_date,
                event_ids=None,
            ),
        )

        distribution_job = self.create_job(
            job_type="recompute_distribution_stats",
            payload={
                "code": code,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )
        distribution_result = self.execute_job_with_retry(
            job=distribution_job,
            operation=lambda: self.recompute_distribution_stats(
                code=code,
                start_date=start_date,
                end_date=end_date,
                metric_ids=None,
            ),
        )

        return {
            "rebuild_daily_features": rebuilt_result,
            "recompute_event_stats": event_result,
            "recompute_distribution_stats": distribution_result,
            "jobs": 3,
        }
