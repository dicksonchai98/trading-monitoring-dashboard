"""Bulk insert and upsert helpers."""

from __future__ import annotations

from typing import Any, Iterable

from sqlalchemy import Table
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def bulk_insert(session: Session, table: Table, rows: Iterable[dict[str, Any]]) -> None:
    rows_list = list(rows)
    if not rows_list:
        return
    session.execute(table.insert(), rows_list)


def upsert(
    session: Session,
    table: Table,
    rows: Iterable[dict[str, Any]],
    conflict_columns: list[str],
    update_columns: list[str],
) -> None:
    rows_list = list(rows)
    if not rows_list:
        return

    dialect = session.get_bind().dialect.name
    if dialect == "postgresql":
        stmt = postgresql.insert(table).values(rows_list)
        update_map = {col: getattr(stmt.excluded, col) for col in update_columns}
        stmt = stmt.on_conflict_do_update(index_elements=conflict_columns, set_=update_map)
        session.execute(stmt)
        return

    if dialect == "sqlite":
        stmt = sqlite.insert(table).values(rows_list)
        update_map = {col: getattr(stmt.excluded, col) for col in update_columns}
        stmt = stmt.on_conflict_do_update(index_elements=conflict_columns, set_=update_map)
        session.execute(stmt)
        return

    for row in rows_list:
        try:
            session.execute(table.insert().values(**row))
        except IntegrityError:
            continue
