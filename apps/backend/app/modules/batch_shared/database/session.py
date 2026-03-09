"""Database helpers for batch runtime."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy.orm import Session

from app.db.session import get_session


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
