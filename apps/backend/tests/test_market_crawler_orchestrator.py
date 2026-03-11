from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

from app.modules.batch_data.market_crawler.application.orchestrator import (
    CrawlerOrchestrator,
    classify_failure,
)
from app.modules.batch_data.market_crawler.domain.contracts import (
    FetchedPayload,
    NormalizedRecord,
    ParsedRow,
)
from app.modules.batch_data.market_crawler.registry.dataset_registry import load_dataset_registry


def _build_registry(tmp_path: Path):
    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()
    (datasets_dir / "taifex.yaml").write_text(
        """
dataset_code: taifex_institution_open_interest_daily
dataset_name: TAIFEX institutional open interest
source_name: taifex_data_gov
enabled: true
source:
  endpoint_template: https://example.com
  method: GET
  response_format: csv
schedule:
  expected_publication_time: 13:45-16:15 Asia/Taipei
  retry_policy:
    max_attempts: 3
    retry_interval_minutes: 15
pipeline:
  parser: taifex_csv_parser
  normalizer: taifex_institution_open_interest_normalizer
  validator: taifex_institution_open_interest_validator
  parser_version: v1
storage:
  table: market_open_interest_daily
  write_mode: upsert
  primary_key:
    - data_date
    - market_code
    - instrument_code
    - entity_code
    - source
""".strip(),
        encoding="utf-8",
    )
    return load_dataset_registry(
        datasets_dir=datasets_dir,
        parser_bindings={"taifex_csv_parser"},
        normalizer_bindings={"taifex_institution_open_interest_normalizer"},
        validator_bindings={"taifex_institution_open_interest_validator"},
    )


@dataclass
class _Validation:
    is_valid: bool
    errors: list[str]
    normalized_records: list[NormalizedRecord]


class _Recorder:
    def __init__(self) -> None:
        self.events: list[str] = []
        self.rows_written = 0

    def start(self, dataset_code: str, target_date: date, trigger_type: str) -> int:
        self.events.append(f"start:{dataset_code}:{target_date}:{trigger_type}")
        return 42

    def stage(self, job_id: int, stage: str) -> None:
        self.events.append(f"stage:{job_id}:{stage}")

    def complete(
        self,
        job_id: int,
        rows_fetched: int,
        rows_normalized: int,
        rows_persisted: int,
    ) -> None:
        self.events.append(f"complete:{job_id}:{rows_fetched}:{rows_normalized}:{rows_persisted}")

    def fail(self, job_id: int, error_category: str, error_stage: str, message: str) -> None:
        self.events.append(f"fail:{job_id}:{error_category}:{error_stage}:{message}")


def test_orchestrator_single_date_success(tmp_path: Path) -> None:
    registry = _build_registry(tmp_path)
    recorder = _Recorder()

    def fetch() -> FetchedPayload:
        return FetchedPayload(
            content="h1,h2\nv1,v2\n",
            content_type="text/csv",
            fetched_at=datetime.now(timezone.utc),
            source_url="https://example.com",
        )

    def parse(_payload: FetchedPayload) -> list[ParsedRow]:
        return [ParsedRow(raw_fields={"entity": "foreign"})]

    def normalize(_rows: list[ParsedRow]) -> list[NormalizedRecord]:
        return [
            NormalizedRecord(
                dataset_code="taifex_institution_open_interest_daily",
                data_date=date(2026, 3, 9),
                market_code="TAIFEX",
                instrument_code="TX",
                entity_code="foreign",
                payload={"long_trade_oi": 100},
            )
        ]

    def validate(rows: list[NormalizedRecord]) -> _Validation:
        return _Validation(is_valid=True, errors=[], normalized_records=rows)

    def persist(rows: list[NormalizedRecord]) -> int:
        return len(rows)

    orchestrator = CrawlerOrchestrator(
        dataset_registry=registry,
        job_repository=recorder,
        fetch=fetch,
        parse=parse,
        normalize=normalize,
        validate=validate,
        persist=persist,
    )

    result = orchestrator.run(
        dataset_code="taifex_institution_open_interest_daily",
        target_date=date(2026, 3, 9),
        trigger_type="manual",
    )

    assert result["job_id"] == 42
    assert result["rows_persisted"] == 1
    assert "stage:42:FETCH" in recorder.events
    assert "stage:42:PERSIST" in recorder.events


def test_orchestrator_marks_validation_failure(tmp_path: Path) -> None:
    registry = _build_registry(tmp_path)
    recorder = _Recorder()

    orchestrator = CrawlerOrchestrator(
        dataset_registry=registry,
        job_repository=recorder,
        fetch=lambda: FetchedPayload(
            content="h1,h2\n",
            content_type="text/csv",
            fetched_at=datetime.now(timezone.utc),
            source_url="https://example.com",
        ),
        parse=lambda _payload: [ParsedRow(raw_fields={})],
        normalize=lambda _rows: [],
        validate=lambda _rows: _Validation(
            is_valid=False,
            errors=["bad schema"],
            normalized_records=[],
        ),
        persist=lambda _rows: 0,
    )

    result = orchestrator.run(
        dataset_code="taifex_institution_open_interest_daily",
        target_date=date(2026, 3, 9),
        trigger_type="manual",
    )

    assert result["status"] == "FAILED"
    assert any("fail:42:validation_error:VALIDATE" in event for event in recorder.events)


def test_classify_failure() -> None:
    assert classify_failure(RuntimeError("HTTP 503")) == "network_error"
    assert classify_failure(RuntimeError("publication not ready")) == "publication_not_ready"
    assert classify_failure(RuntimeError("schema mismatch")) == "source_format_error"
    assert classify_failure(RuntimeError("validation failed")) == "validation_error"
    assert classify_failure(RuntimeError("db constraint")) == "persistence_error"
    assert classify_failure(RuntimeError("unknown")) == "persistence_error"
