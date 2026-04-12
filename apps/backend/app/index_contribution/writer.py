"""Database snapshot writers for index contribution worker."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.index_contribution_ranking_1m import IndexContributionRanking1mModel
from app.models.index_contribution_snapshot_1m import IndexContributionSnapshot1mModel
from app.models.sector_contribution_snapshot_1m import SectorContributionSnapshot1mModel


def flush_symbol_snapshots(
    *,
    session: Session,
    index_code: str,
    trade_date: date,
    minute_ts: datetime,
    symbol_rows: list[dict[str, Any]],
) -> None:
    top_rank_map = {row["symbol"]: idx + 1 for idx, row in enumerate(_rank_top(symbol_rows))}
    bottom_rank_map = {row["symbol"]: idx + 1 for idx, row in enumerate(_rank_bottom(symbol_rows))}
    for row in symbol_rows:
        symbol = str(row["symbol"])
        existing = session.execute(
            select(IndexContributionSnapshot1mModel).where(
                IndexContributionSnapshot1mModel.index_code == index_code,
                IndexContributionSnapshot1mModel.minute_ts == minute_ts,
                IndexContributionSnapshot1mModel.symbol == symbol,
            )
        ).scalar_one_or_none()
        values = {
            "index_code": index_code,
            "trade_date": trade_date,
            "minute_ts": minute_ts,
            "symbol": symbol,
            "symbol_name": str(row["symbol_name"]),
            "sector": str(row["sector"]),
            "last_price": float(row["last_price"]),
            "prev_close": float(row["prev_close"]),
            "weight": float(row["weight"]),
            "pct_change": float(row["pct_change"]),
            "contribution_points": float(row["contribution_points"]),
            "rank_top": top_rank_map.get(symbol),
            "rank_bottom": bottom_rank_map.get(symbol),
            "weight_version": row.get("weight_version"),
            "payload": dict(row),
        }
        if existing is None:
            session.add(IndexContributionSnapshot1mModel(**values))
            continue
        _assign(existing, values)


def flush_ranking_snapshots(
    *,
    session: Session,
    index_code: str,
    trade_date: date,
    minute_ts: datetime,
    top_rows: list[dict[str, Any]],
    bottom_rows: list[dict[str, Any]],
) -> None:
    _flush_ranking_type(
        session=session,
        index_code=index_code,
        trade_date=trade_date,
        minute_ts=minute_ts,
        ranking_type="top",
        rows=top_rows,
    )
    _flush_ranking_type(
        session=session,
        index_code=index_code,
        trade_date=trade_date,
        minute_ts=minute_ts,
        ranking_type="bottom",
        rows=bottom_rows,
    )


def flush_sector_snapshots(
    *,
    session: Session,
    index_code: str,
    trade_date: date,
    minute_ts: datetime,
    sector_rows: dict[str, float],
) -> None:
    for sector, contribution_points in sector_rows.items():
        existing = session.execute(
            select(SectorContributionSnapshot1mModel).where(
                SectorContributionSnapshot1mModel.index_code == index_code,
                SectorContributionSnapshot1mModel.minute_ts == minute_ts,
                SectorContributionSnapshot1mModel.sector == sector,
            )
        ).scalar_one_or_none()
        values = {
            "index_code": index_code,
            "trade_date": trade_date,
            "minute_ts": minute_ts,
            "sector": sector,
            "contribution_points": float(contribution_points),
            "weight_version": None,
            "payload": {"sector": sector, "contribution_points": float(contribution_points)},
        }
        if existing is None:
            session.add(SectorContributionSnapshot1mModel(**values))
            continue
        _assign(existing, values)


def _flush_ranking_type(
    *,
    session: Session,
    index_code: str,
    trade_date: date,
    minute_ts: datetime,
    ranking_type: str,
    rows: list[dict[str, Any]],
) -> None:
    for idx, row in enumerate(rows, start=1):
        existing = session.execute(
            select(IndexContributionRanking1mModel).where(
                IndexContributionRanking1mModel.index_code == index_code,
                IndexContributionRanking1mModel.minute_ts == minute_ts,
                IndexContributionRanking1mModel.ranking_type == ranking_type,
                IndexContributionRanking1mModel.rank_no == idx,
            )
        ).scalar_one_or_none()
        values = {
            "index_code": index_code,
            "trade_date": trade_date,
            "minute_ts": minute_ts,
            "ranking_type": ranking_type,
            "rank_no": idx,
            "symbol": str(row["symbol"]),
            "symbol_name": str(row["symbol_name"]),
            "sector": str(row["sector"]),
            "contribution_points": float(row["contribution_points"]),
            "weight_version": row.get("weight_version"),
            "payload": dict(row),
        }
        if existing is None:
            session.add(IndexContributionRanking1mModel(**values))
            continue
        _assign(existing, values)


def _rank_top(symbol_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        symbol_rows,
        key=lambda row: (-float(row["contribution_points"]), str(row["symbol"])),
    )[:20]


def _rank_bottom(symbol_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        symbol_rows,
        key=lambda row: (float(row["contribution_points"]), str(row["symbol"])),
    )[:20]


def _assign(target: Any, values: dict[str, Any]) -> None:
    for key, value in values.items():
        setattr(target, key, value)
