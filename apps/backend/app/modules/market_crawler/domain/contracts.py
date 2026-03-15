"""Domain contracts for crawler pipeline layers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any


@dataclass(frozen=True)
class CrawlerJobParams:
    dataset_code: str
    target_date: date
    trigger_type: str
    start_date: date | None = None
    end_date: date | None = None
    parent_job_id: int | None = None
    correlation_id: str | None = None


@dataclass(frozen=True)
class FetchedPayload:
    content: str | bytes
    content_type: str
    fetched_at: datetime
    source_url: str


@dataclass(frozen=True)
class ParsedRow:
    raw_fields: dict[str, Any]


@dataclass(frozen=True)
class NormalizedRecord:
    dataset_code: str
    data_date: date
    market_code: str
    instrument_code: str
    entity_code: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class ValidationResult:
    is_valid: bool
    errors: list[str]
    normalized_records: list[NormalizedRecord]


@dataclass(frozen=True)
class SourceSpec:
    endpoint_template: str
    method: str
    response_format: str
    encoding: str = "utf-8"


@dataclass(frozen=True)
class RetryPolicySpec:
    max_attempts: int
    retry_interval_minutes: int


@dataclass(frozen=True)
class ScheduleSpec:
    expected_publication_time: str
    retry_policy: RetryPolicySpec


@dataclass(frozen=True)
class PipelineSpec:
    parser: str
    normalizer: str
    validator: str
    parser_version: str


@dataclass(frozen=True)
class StorageSpec:
    table: str
    write_mode: str
    primary_key: list[str]


@dataclass(frozen=True)
class DatasetDefinition:
    dataset_code: str
    dataset_name: str
    source_name: str
    enabled: bool
    source: SourceSpec
    schedule: ScheduleSpec
    pipeline: PipelineSpec
    storage: StorageSpec
