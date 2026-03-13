"""Normalizer for TAIFEX institutional open-interest dataset."""

from __future__ import annotations

from app.modules.batch_data.market_crawler.domain.contracts import (
    NormalizedRecord,
    ParsedRow,
)

from .taifex_institution_open_interest_source_row import (
    TaifexInstitutionOpenInterestSourceRow,
)


class TaifexInstitutionOpenInterestNormalizer:
    def normalize(self, parsed_rows: list[ParsedRow], dataset_code: str) -> list[NormalizedRecord]:
        result: list[NormalizedRecord] = []
        for row in parsed_rows:
            source_row = TaifexInstitutionOpenInterestSourceRow.model_validate(row.raw_fields)
            payload = {
                "long_trade_oi": source_row.long_trade_oi,
                "short_trade_oi": source_row.short_trade_oi,
                "net_trade_oi": source_row.net_trade_oi,
                "long_trade_amount_k": source_row.long_trade_amount_k,
                "short_trade_amount_k": source_row.short_trade_amount_k,
                "net_trade_amount_k": source_row.net_trade_amount_k,
                "long_open_interest": source_row.long_open_interest,
                "short_open_interest": source_row.short_open_interest,
                "net_open_interest": source_row.net_open_interest,
                "long_open_interest_amount_k": source_row.long_open_interest_amount_k,
                "short_open_interest_amount_k": source_row.short_open_interest_amount_k,
                "net_open_interest_amount_k": source_row.net_open_interest_amount_k,
                "source": source_row.source,
                "parser_version": source_row.parser_version,
            }
            result.append(
                NormalizedRecord(
                    dataset_code=dataset_code,
                    data_date=source_row.data_date,
                    market_code=source_row.market_code,
                    instrument_code=source_row.instrument_code,
                    entity_code=source_row.entity_code,
                    payload=payload,
                )
            )
        return result
