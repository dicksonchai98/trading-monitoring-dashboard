"""Repository for users."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import UserModel


@dataclass
class UserRecord:
    username: str
    password_hash: str
    role: str


class UserRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_by_username(self, username: str) -> UserRecord | None:
        with self._session_factory() as session:
            stmt = select(UserModel).where(UserModel.username == username)
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                return None
            return UserRecord(username=row.username, password_hash=row.password_hash, role=row.role)

    def create_user(self, username: str, password_hash: str, role: str) -> UserRecord:
        with self._session_factory() as session:
            model = UserModel(username=username, password_hash=password_hash, role=role)
            session.add(model)
            try:
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError("user_exists") from exc
            return UserRecord(username=model.username, password_hash=model.password_hash, role=model.role)

