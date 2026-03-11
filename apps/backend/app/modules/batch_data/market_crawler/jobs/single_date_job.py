"""Single-date crawler job implementation."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import date
from typing import Callable

from app.db.session import SessionLocal
from app.modules.batch_data.market_crawler.application.orchestrator import CrawlerOrchestrator
from app.modules.batch_data.market_crawler.domain.contracts import CrawlerJobParams
from app.modules.batch_data.market_crawler.infrastructure.metrics import CrawlerMetrics
from app.modules.batch_data.market_crawler.registry import (
    get_fetcher_registry,
    get_normalizer_registry,
    get_parser_registry,
    get_validator_registry,
    load_default_dataset_registry,
)
from app.modules.batch_data.market_crawler.repositories.crawler_job_repository import (
    CrawlerJobRepository,
)
from app.modules.batch_data.market_crawler.repositories.market_open_interest_repository import (
    MarketOpenInterestRepository,
)
from app.modules.batch_shared.jobs.interfaces import JobContext, JobResult
from app.modules.batch_shared.logging.context import JobLogContext, get_job_logger

logger = logging.getLogger(__name__)


class SingleDateCrawlerJob:
    def __init__(
        self,
        orchestrator_factory: Callable[
            [CrawlerJobParams],
            CrawlerOrchestrator,
        ]
        | None = None,
        sleep_fn: Callable[[float], None] | None = None,
    ) -> None:
        self.orchestrator_factory = orchestrator_factory
        self.sleep_fn = sleep_fn or time.sleep
        self.metrics = CrawlerMetrics()

    def execute(self, params: dict[str, object], context: JobContext) -> JobResult:
        job_params = _parse_job_params(params)
        dataset_registry = load_default_dataset_registry()
        dataset = dataset_registry.get(job_params.dataset_code)

        parser_registry = get_parser_registry()
        normalizer_registry = get_normalizer_registry()
        validator_registry = get_validator_registry()
        fetcher_registry = get_fetcher_registry()

        parser = parser_registry[dataset.pipeline.parser]()
        normalizer = normalizer_registry[dataset.pipeline.normalizer]()
        validator = validator_registry[dataset.pipeline.validator]()
        fetcher = fetcher_registry["http_fetcher"]()

        repository = MarketOpenInterestRepository(session_factory=SessionLocal)
        job_repo = CrawlerJobRepository(session_factory=SessionLocal)

        orchestrator = (
            self.orchestrator_factory(job_params)
            if self.orchestrator_factory is not None
            else CrawlerOrchestrator(
                dataset_registry=dataset_registry,
                job_repository=job_repo,
                fetch=lambda: fetcher.fetch(
                    dataset.source.endpoint_template, job_params.target_date
                ),
                parse=lambda payload: parser.parse(payload.content),
                normalize=lambda rows: normalizer.normalize(
                    rows, dataset_code=dataset.dataset_code
                ),
                validate=lambda rows: validator.validate(rows),
                persist=lambda rows: repository.upsert_records(rows),
            )
        )

        log_context = JobLogContext(
            job_id=context.job_id, job_type=job_params.dataset_code, execution_stage="start"
        )
        job_logger = get_job_logger(__name__, log_context)
        job_logger.info("crawler job started")

        start_time = time.perf_counter()
        result = orchestrator.run(
            dataset_code=job_params.dataset_code,
            target_date=job_params.target_date,
            trigger_type=job_params.trigger_type,
        )
        if result.get("status") == "COMPLETED":
            _ = start_time
            rows_fetched = int(result.get("rows_fetched", 0))
            rows_normalized = int(result.get("rows_normalized", 0))
            rows_persisted = int(result.get("rows_persisted", 0))
            self.metrics.inc("crawler_rows_fetched_total", rows_fetched)
            self.metrics.inc("crawler_rows_normalized_total", rows_normalized)
            self.metrics.inc("crawler_rows_persisted_total", rows_persisted)
            job_logger.info(
                "crawler job completed",
                extra={"rows": rows_persisted},
            )
            return JobResult(rows_processed=rows_persisted)

        category = str(result.get("error_category", "persistence_error"))
        stage = str(result.get("error_stage", "UNKNOWN"))
        job_logger.error(
            "crawler job failed",
            extra={"error_category": category, "stage": stage},
        )
        if category == "network_error":
            raise ConnectionError(f"crawler job failed: {category}")
        raise ValueError(f"crawler job failed: {category}")


def _parse_job_params(params: dict[str, object]) -> CrawlerJobParams:
    dataset_code = str(params.get("dataset_code", "taifex_institution_open_interest_daily"))
    target_date_raw = params.get("target_date")
    trigger_type = str(params.get("trigger_type", "manual"))
    if target_date_raw is None:
        raise ValueError("target_date is required")
    target_date = date.fromisoformat(str(target_date_raw))
    return CrawlerJobParams(
        dataset_code=dataset_code, target_date=target_date, trigger_type=trigger_type
    )


