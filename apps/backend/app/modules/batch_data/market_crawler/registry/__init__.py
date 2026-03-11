"""Registry package for crawler datasets."""

from pathlib import Path

from app.modules.batch_data.market_crawler.registry.dataset_registry import (
    DatasetRegistry,
    load_dataset_registry,
)
from app.modules.batch_data.market_crawler.registry.pipeline_registry import (
    get_fetcher_registry,
    get_normalizer_registry,
    get_parser_registry,
    get_validator_registry,
)


def load_default_dataset_registry() -> DatasetRegistry:
    base_dir = Path(__file__).resolve().parent.parent / "datasets"
    parser_bindings = set(get_parser_registry().keys())
    normalizer_bindings = set(get_normalizer_registry().keys())
    validator_bindings = set(get_validator_registry().keys())
    return load_dataset_registry(
        datasets_dir=base_dir,
        parser_bindings=parser_bindings,
        normalizer_bindings=normalizer_bindings,
        validator_bindings=validator_bindings,
    )


__all__ = [
    "DatasetRegistry",
    "load_dataset_registry",
    "load_default_dataset_registry",
    "get_fetcher_registry",
    "get_parser_registry",
    "get_normalizer_registry",
    "get_validator_registry",
]
