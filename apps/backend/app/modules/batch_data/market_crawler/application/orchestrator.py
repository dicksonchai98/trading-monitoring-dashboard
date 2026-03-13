"""Crawler orchestrator for single-date execution."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Callable, Protocol

try:  # Optional dependency used by fetchers.
    import httpx
except Exception:  # pragma: no cover - optional import
    httpx = None

try:  # Optional dependency used by source-row validation.
    from pydantic import ValidationError
except Exception:  # pragma: no cover - optional import
    ValidationError = None

from app.modules.batch_data.market_crawler.domain.contracts import (
    FetchedPayload,
    NormalizedRecord,
    ParsedRow,
    ValidationResult,
)
from app.modules.batch_data.market_crawler.registry.dataset_registry import DatasetRegistry

logger = logging.getLogger(__name__)


class CrawlerJobRepositoryProtocol(Protocol):
    def start(self, dataset_code: str, target_date: date, trigger_type: str) -> int: ...
    def stage(self, job_id: int, stage: str) -> None: ...
    def complete(
        self,
        job_id: int,
        rows_fetched: int,
        rows_normalized: int,
        rows_persisted: int,
    ) -> None: ...
    def fail(self, job_id: int, error_category: str, error_stage: str, message: str) -> None: ...


@dataclass(frozen=True)
class CrawlerFailure(RuntimeError):
    category: str
    stage: str
    message: str

    def __str__(self) -> str:
        return self.message


@dataclass
class CrawlerOrchestrator:
    dataset_registry: DatasetRegistry
    job_repository: CrawlerJobRepositoryProtocol
    fetch: Callable[[], FetchedPayload]
    parse: Callable[[FetchedPayload], list[ParsedRow]]
    normalize: Callable[[list[ParsedRow]], list[NormalizedRecord]]
    validate: Callable[[list[NormalizedRecord]], ValidationResult]
    persist: Callable[[list[NormalizedRecord]], int]

    def run(self, dataset_code: str, target_date: date, trigger_type: str) -> dict[str, object]:
        dataset = self.dataset_registry.get(dataset_code)
        job_id = self.job_repository.start(
            dataset_code=dataset_code,
            target_date=target_date,
            trigger_type=trigger_type,
        )
        rows_fetched = 0
        rows_normalized = 0
        rows_persisted = 0
        try:
            self.job_repository.stage(job_id, "FETCH")
            logger.info(
                "crawler stage start",
                extra={
                    "job_id": job_id,
                    "dataset_code": dataset_code,
                    "source_name": dataset.source_name,
                    "target_date": target_date.isoformat(),
                    "execution_stage": "FETCH",
                },
            )
            payload = self.fetch()

            self.job_repository.stage(job_id, "PARSE")
            logger.info(
                "crawler stage start",
                extra={
                    "job_id": job_id,
                    "dataset_code": dataset_code,
                    "source_name": dataset.source_name,
                    "target_date": target_date.isoformat(),
                    "execution_stage": "PARSE",
                },
            )
            parsed_rows = self.parse(payload)
            rows_fetched = len(parsed_rows)

            self.job_repository.stage(job_id, "NORMALIZE")
            logger.info(
                "crawler stage start",
                extra={
                    "job_id": job_id,
                    "dataset_code": dataset_code,
                    "source_name": dataset.source_name,
                    "target_date": target_date.isoformat(),
                    "execution_stage": "NORMALIZE",
                },
            )
            normalized = self.normalize(parsed_rows)
            rows_normalized = len(normalized)

            self.job_repository.stage(job_id, "VALIDATE")
            logger.info(
                "crawler stage start",
                extra={
                    "job_id": job_id,
                    "dataset_code": dataset_code,
                    "source_name": dataset.source_name,
                    "target_date": target_date.isoformat(),
                    "execution_stage": "VALIDATE",
                },
            )
            validation = self.validate(normalized)
            if not validation.is_valid:
                message = "; ".join(validation.errors) if validation.errors else "validation failed"
                if "publication not ready" in message.lower():
                    raise CrawlerFailure(
                        category="publication_not_ready",
                        stage="VALIDATE",
                        message=message,
                    )
                raise CrawlerFailure(category="validation_error", stage="VALIDATE", message=message)

            self.job_repository.stage(job_id, "PERSIST")
            logger.info(
                "crawler stage start",
                extra={
                    "job_id": job_id,
                    "dataset_code": dataset_code,
                    "source_name": dataset.source_name,
                    "target_date": target_date.isoformat(),
                    "execution_stage": "PERSIST",
                },
            )
            rows_persisted = self.persist(validation.normalized_records)
            self.job_repository.complete(
                job_id=job_id,
                rows_fetched=rows_fetched,
                rows_normalized=rows_normalized,
                rows_persisted=rows_persisted,
            )
            logger.info(
                "crawler job completed",
                extra={
                    "job_id": job_id,
                    "dataset_code": dataset_code,
                    "source_name": dataset.source_name,
                    "target_date": target_date.isoformat(),
                    "execution_stage": "COMPLETE",
                    "rows_fetched": rows_fetched,
                    "rows_normalized": rows_normalized,
                    "rows_persisted": rows_persisted,
                },
            )
            return {
                "job_id": job_id,
                "status": "COMPLETED",
                "rows_fetched": rows_fetched,
                "rows_normalized": rows_normalized,
                "rows_persisted": rows_persisted,
            }
        except Exception as err:
            category = classify_failure(err)
            stage = _infer_stage(err, category)
            self.job_repository.fail(job_id, category, stage, str(err))
            logger.warning(
                "crawler job failed",
                extra={
                    "job_id": job_id,
                    "dataset_code": dataset_code,
                    "source_name": dataset.source_name,
                    "target_date": target_date.isoformat(),
                    "execution_stage": stage,
                    "error_category": category,
                },
            )
            return {
                "job_id": job_id,
                "status": "FAILED",
                "error_category": category,
                "error_stage": stage,
            }


def classify_failure(err: Exception) -> str:
    if isinstance(err, CrawlerFailure):
        return err.category
    if ValidationError is not None and isinstance(err, ValidationError):
        return "source_format_error"
    if isinstance(err, KeyError):
        return "source_format_error"
    if httpx is not None and isinstance(err, httpx.RequestError):
        return "network_error"
    if isinstance(err, OSError):
        return "network_error"
    message = str(err).lower()
    if (
        "http" in message
        or "timeout" in message
        or "connection" in message
        or "connecterror" in message
        or "socket" in message
        or "winerror" in message
    ):
        return "network_error"
    if "publication not ready" in message:
        return "publication_not_ready"
    if "schema mismatch" in message or "parse" in message:
        return "source_format_error"
    if "validation" in message or "bad schema" in message:
        return "validation_error"
    return "persistence_error"


def _infer_stage(err: Exception, category: str) -> str:
    if isinstance(err, CrawlerFailure):
        return err.stage
    if ValidationError is not None and isinstance(err, ValidationError):
        return "NORMALIZE"
    if isinstance(err, KeyError):
        return "NORMALIZE"
    if category == "validation_error":
        return "VALIDATE"
    if category in {"network_error", "publication_not_ready"}:
        return "FETCH"
    if category == "source_format_error":
        return "PARSE"
    return "PERSIST"
