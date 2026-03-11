"""Normalizer for TAIFEX institutional open-interest dataset."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.modules.batch_data.market_crawler.domain.contracts import NormalizedRecord, ParsedRow


class TaifexInstitutionOpenInterestNormalizer:
    def normalize(self, parsed_rows: list[ParsedRow], dataset_code: str) -> list[NormalizedRecord]:
        result: list[NormalizedRecord] = []
        for row in parsed_rows:
            fields = row.raw_fields
            payload = {
                "long_trade_oi": int(fields.get("long_trade_oi", "0")),
                "short_trade_oi": int(fields.get("short_trade_oi", "0")),
                "net_trade_oi": int(fields.get("net_trade_oi", "0")),
                "long_trade_amount_k": Decimal(fields.get("long_trade_amount_k", "0")),
                "short_trade_amount_k": Decimal(fields.get("short_trade_amount_k", "0")),
                "net_trade_amount_k": Decimal(fields.get("net_trade_amount_k", "0")),
                "long_open_interest": int(fields.get("long_open_interest", "0")),
                "short_open_interest": int(fields.get("short_open_interest", "0")),
                "net_open_interest": int(fields.get("net_open_interest", "0")),
                "long_open_interest_amount_k": Decimal(
                    fields.get("long_open_interest_amount_k", "0")
                ),
                "short_open_interest_amount_k": Decimal(
                    fields.get("short_open_interest_amount_k", "0")
                ),
                "net_open_interest_amount_k": Decimal(
                    fields.get("net_open_interest_amount_k", "0")
                ),
                "source": fields.get("source", "taifex_data_gov"),
                "parser_version": "v1",
            }
            result.append(
                NormalizedRecord(
                    dataset_code=dataset_code,
                    data_date=date.fromisoformat(str(fields["data_date"])),
                    market_code=str(fields["market_code"]),
                    instrument_code=str(fields["instrument_code"]),
                    entity_code=str(fields["entity_code"]),
                    payload=payload,
                )
            )
        return result
