"""Pipeline component registry for crawler datasets."""

from __future__ import annotations

from typing import Callable

from ..fetchers.http_fetcher import HttpFetcher
from ..normalizers.taifex_institution_open_interest_normalizer import (
    TaifexInstitutionOpenInterestNormalizer,
)
from ..parsers.taifex_csv_parser import TaifexCsvParser
from ..validators.taifex_institution_open_interest_validator import (
    TaifexInstitutionOpenInterestValidator,
)

FetcherFactory = Callable[[], HttpFetcher]
ParserFactory = Callable[[], TaifexCsvParser]
NormalizerFactory = Callable[[], TaifexInstitutionOpenInterestNormalizer]
ValidatorFactory = Callable[[], TaifexInstitutionOpenInterestValidator]


def get_fetcher_registry() -> dict[str, FetcherFactory]:
    return {
        "http_fetcher": HttpFetcher,
    }


def get_parser_registry() -> dict[str, ParserFactory]:
    return {
        "taifex_csv_parser": TaifexCsvParser,
    }


def get_normalizer_registry() -> dict[str, NormalizerFactory]:
    return {
        "taifex_institution_open_interest_normalizer": (TaifexInstitutionOpenInterestNormalizer),
    }


def get_validator_registry() -> dict[str, ValidatorFactory]:
    return {
        "taifex_institution_open_interest_validator": (TaifexInstitutionOpenInterestValidator),
    }
