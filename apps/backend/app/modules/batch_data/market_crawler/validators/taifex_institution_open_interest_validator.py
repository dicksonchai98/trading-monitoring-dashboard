"""Validator for TAIFEX institutional open-interest dataset."""

from __future__ import annotations

from datetime import date
from typing import Iterable

from app.modules.batch_data.market_crawler.domain.contracts import (
    NormalizedRecord,
    ValidationResult,
)


class TaifexInstitutionOpenInterestValidator:
    def validate(self, records: Iterable[NormalizedRecord]) -> ValidationResult:
        normalized = list(records)
        if not normalized:
            return ValidationResult(
                is_valid=False,
                errors=["publication not ready: empty dataset"],
                normalized_records=[],
            )

        errors: list[str] = []
        for index, record in enumerate(normalized):
            if not isinstance(record.data_date, date):
                errors.append(f"record[{index}] invalid data_date")
            if not record.market_code:
                errors.append(f"record[{index}] missing market_code")
            if not record.instrument_code:
                errors.append(f"record[{index}] missing instrument_code")
            if not record.entity_code:
                errors.append(f"record[{index}] missing entity_code")

        if errors:
            return ValidationResult(is_valid=False, errors=errors, normalized_records=[])

        return ValidationResult(is_valid=True, errors=[], normalized_records=normalized)
