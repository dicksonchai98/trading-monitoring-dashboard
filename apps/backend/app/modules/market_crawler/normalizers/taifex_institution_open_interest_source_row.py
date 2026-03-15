"""Pydantic source row model for TAIFEX institutional open-interest CSV rows."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class TaifexInstitutionOpenInterestSourceRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    data_date: date = Field(validation_alias=AliasChoices("data_date", "日期"))
    market_code: str = Field(default="TAIFEX", validation_alias=AliasChoices("market_code"))
    instrument_code: str = Field(
        validation_alias=AliasChoices("instrument_code", "商品別", "契約", "商品名稱")
    )
    entity_code: str = Field(validation_alias=AliasChoices("entity_code", "身份別", "身份別名稱"))
    long_trade_oi: int = Field(validation_alias=AliasChoices("long_trade_oi", "多方交易口數"))
    short_trade_oi: int = Field(validation_alias=AliasChoices("short_trade_oi", "空方交易口數"))
    net_trade_oi: int = Field(validation_alias=AliasChoices("net_trade_oi", "多空交易口數淨額"))
    long_trade_amount_k: Decimal = Field(
        validation_alias=AliasChoices("long_trade_amount_k", "多方交易契約金額(百萬元)")
    )
    short_trade_amount_k: Decimal = Field(
        validation_alias=AliasChoices("short_trade_amount_k", "空方交易契約金額(百萬元)")
    )
    net_trade_amount_k: Decimal = Field(
        validation_alias=AliasChoices("net_trade_amount_k", "多空交易契約金額淨額(百萬元)")
    )
    long_open_interest: int = Field(
        validation_alias=AliasChoices("long_open_interest", "多方未平倉口數")
    )
    short_open_interest: int = Field(
        validation_alias=AliasChoices("short_open_interest", "空方未平倉口數")
    )
    net_open_interest: int = Field(
        validation_alias=AliasChoices("net_open_interest", "多空未平倉口數淨額")
    )
    long_open_interest_amount_k: Decimal = Field(
        validation_alias=AliasChoices(
            "long_open_interest_amount_k",
            "多方未平倉契約金額(百萬元)",
        )
    )
    short_open_interest_amount_k: Decimal = Field(
        validation_alias=AliasChoices(
            "short_open_interest_amount_k",
            "空方未平倉契約金額(百萬元)",
        )
    )
    net_open_interest_amount_k: Decimal = Field(
        validation_alias=AliasChoices(
            "net_open_interest_amount_k",
            "多空未平倉契約金額淨額(百萬元)",
        )
    )
    source: str = Field(
        default="taifex_data_gov",
        validation_alias=AliasChoices("source"),
    )
    parser_version: str = Field(
        default="v1",
        validation_alias=AliasChoices("parser_version"),
    )

    @field_validator("data_date", mode="before")
    @classmethod
    def _parse_data_date(cls, value: object) -> object:
        text = str(value).strip()
        if len(text) == 8 and text.isdigit():
            return date(int(text[0:4]), int(text[4:6]), int(text[6:8]))
        return text
