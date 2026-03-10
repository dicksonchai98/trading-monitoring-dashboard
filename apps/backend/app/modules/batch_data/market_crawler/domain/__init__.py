"""Domain contracts for market crawler."""

from app.modules.batch_data.market_crawler.domain.contracts import (
    CrawlerJobParams,
    DatasetDefinition,
    FetchedPayload,
    NormalizedRecord,
    ParsedRow,
    ValidationResult,
)

__all__ = [
    "CrawlerJobParams",
    "DatasetDefinition",
    "FetchedPayload",
    "ParsedRow",
    "NormalizedRecord",
    "ValidationResult",
]
