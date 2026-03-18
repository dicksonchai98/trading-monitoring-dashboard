from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
from app.modules.market_crawler.registry.dataset_registry import load_dataset_registry


def _write_dataset(path: Path, content: str) -> None:
    path.write_text(textwrap.dedent(content), encoding="utf-8")


def test_load_dataset_registry_success(tmp_path: Path) -> None:
    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()
    _write_dataset(
        datasets_dir / "taifex.yaml",
        """
        dataset_code: taifex_institution_open_interest_daily
        dataset_name: TAIFEX institutional open interest
        source_name: taifex_data_gov
        enabled: true
        source:
          endpoint_template: https://www.taifex.com.tw/data_gov/taifex_open_data.asp?data_name=MarketDataOfMajorInstitutionalTradersDetailsOfFuturesContractsBytheDate
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
        """,
    )

    registry = load_dataset_registry(
        datasets_dir=datasets_dir,
        parser_bindings={"taifex_csv_parser"},
        normalizer_bindings={"taifex_institution_open_interest_normalizer"},
        validator_bindings={"taifex_institution_open_interest_validator"},
    )

    dataset = registry.get("taifex_institution_open_interest_daily")
    assert dataset.dataset_code == "taifex_institution_open_interest_daily"
    assert dataset.source.response_format == "csv"


def test_load_dataset_registry_rejects_duplicate_dataset_code(tmp_path: Path) -> None:
    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()
    common = """
        dataset_code: taifex_institution_open_interest_daily
        dataset_name: Name
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
          parser: p1
          normalizer: n1
          validator: v1
          parser_version: v1
        storage:
          table: market_open_interest_daily
          write_mode: upsert
          primary_key: [data_date, market_code, instrument_code, entity_code, source]
    """
    _write_dataset(datasets_dir / "a.yaml", common)
    _write_dataset(datasets_dir / "b.yaml", common)

    with pytest.raises(ValueError, match="duplicate dataset_code"):
        load_dataset_registry(
            datasets_dir=datasets_dir,
            parser_bindings={"p1"},
            normalizer_bindings={"n1"},
            validator_bindings={"v1"},
        )


def test_load_dataset_registry_rejects_unknown_pipeline_bindings(tmp_path: Path) -> None:
    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()
    _write_dataset(
        datasets_dir / "taifex.yaml",
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
          parser: unknown_parser
          normalizer: unknown_normalizer
          validator: unknown_validator
          parser_version: v1
        storage:
          table: market_open_interest_daily
          write_mode: upsert
          primary_key: [data_date, market_code, instrument_code, entity_code, source]
        """,
    )

    with pytest.raises(ValueError, match="unresolvable pipeline binding"):
        load_dataset_registry(
            datasets_dir=datasets_dir,
            parser_bindings={"taifex_csv_parser"},
            normalizer_bindings={"taifex_institution_open_interest_normalizer"},
            validator_bindings={"taifex_institution_open_interest_validator"},
        )
