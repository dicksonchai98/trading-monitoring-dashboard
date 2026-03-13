"""CSV parser for TAIFEX open data."""

from __future__ import annotations

import csv
from io import StringIO

from app.modules.batch_data.market_crawler.domain.contracts import ParsedRow


class TaifexCsvParser:
    def parse(self, content: str | bytes) -> list[ParsedRow]:
        text = content.decode("utf-8") if isinstance(content, bytes) else content
        reader = csv.DictReader(StringIO(text))
        rows: list[ParsedRow] = []
        for row in reader:
            cleaned = {
                key.strip().lstrip("\ufeff"): (value or "").strip()
                for key, value in row.items()
                if key is not None
            }
            rows.append(ParsedRow(raw_fields=cleaned))
        return rows
