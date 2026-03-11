from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path

from app.db.session import SessionLocal
from app.models.crawler_job import CrawlerJobModel
from app.models.market_open_interest_daily import MarketOpenInterestDailyModel
from app.modules.batch_data.market_crawler.application.orchestrator import CrawlerOrchestrator
from app.modules.batch_data.market_crawler.domain.contracts import (
    FetchedPayload,
    NormalizedRecord,
    ParsedRow,
)
from app.modules.batch_data.market_crawler.jobs.range_backfill_job import RangeBackfillCrawlerJob
from app.modules.batch_data.market_crawler.registry.dataset_registry import load_dataset_registry
from app.modules.batch_data.market_crawler.repositories.crawler_job_repository import (
    CrawlerJobRepository,
)
from app.modules.batch_data.market_crawler.repositories.market_open_interest_repository import (
    MarketOpenInterestRepository,
)


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


def test_single_date_orchestrator_persists_and_is_idempotent(tmp_path: Path) -> None:
    registry = _build_registry(tmp_path)
    repo = MarketOpenInterestRepository(session_factory=SessionLocal)
    job_repo = CrawlerJobRepository(session_factory=SessionLocal)

    normalized = [
        NormalizedRecord(
            dataset_code="taifex_institution_open_interest_daily",
            data_date=date(2026, 3, 9),
            market_code="TAIFEX",
            instrument_code="TX",
            entity_code="foreign",
            payload={
                "long_trade_oi": 100,
                "short_trade_oi": 50,
                "net_trade_oi": 50,
                "long_trade_amount_k": 10,
                "short_trade_amount_k": 5,
                "net_trade_amount_k": 5,
                "long_open_interest": 120,
                "short_open_interest": 60,
                "net_open_interest": 60,
                "long_open_interest_amount_k": 12,
                "short_open_interest_amount_k": 6,
                "net_open_interest_amount_k": 6,
                "source": "taifex_data_gov",
                "parser_version": "v1",
            },
        )
    ]

    orchestrator = CrawlerOrchestrator(
        dataset_registry=registry,
        job_repository=job_repo,
        fetch=lambda: FetchedPayload(
            content="ok",
            content_type="text/plain",
            fetched_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
            source_url="https://example.com",
        ),
        parse=lambda _payload: [ParsedRow(raw_fields={"row": "1"})],
        normalize=lambda _rows: normalized,
        validate=lambda rows: type(
            "V", (), {"is_valid": True, "errors": [], "normalized_records": rows}
        )(),
        persist=lambda rows: repo.upsert_records(rows),
    )

    result = orchestrator.run(
        dataset_code="taifex_institution_open_interest_daily",
        target_date=date(2026, 3, 9),
        trigger_type="manual",
    )
    assert result["status"] == "COMPLETED"

    # Rerun should keep a single logical row due to upsert.
    orchestrator.run(
        dataset_code="taifex_institution_open_interest_daily",
        target_date=date(2026, 3, 9),
        trigger_type="manual",
    )
    with SessionLocal() as session:
        rows = session.query(MarketOpenInterestDailyModel).all()
        assert len(rows) == 1


def test_range_backfill_creates_parent_and_children() -> None:
    job = RangeBackfillCrawlerJob()
    params = {
        "dataset_code": "taifex_institution_open_interest_daily",
        "start_date": "2026-03-07",
        "end_date": "2026-03-09",
        "trigger_type": "manual",
    }
    job.execute(
        params=params,
        context=type(
            "C", (), {"job_id": 1, "job_type": "test", "update_progress": lambda *_: None}
        )(),
    )

    with SessionLocal() as session:
        parent = (
            session.query(CrawlerJobModel)
            .filter(CrawlerJobModel.range_start == date(2026, 3, 7))
            .one()
        )
        children = (
            session.query(CrawlerJobModel).filter(CrawlerJobModel.parent_job_id == parent.id).all()
        )
        assert parent.correlation_id is not None
        assert len(children) == 3
