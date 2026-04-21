"""Repository for users."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import UserModel


@dataclass
class UserRecord:
    id: str
    username: str
    user_id: str
    email: str
    password_hash: str
    role: str
    stripe_customer_id: str | None


class UserRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_by_username(self, username: str) -> UserRecord | None:
        with self._session_factory() as session:
            stmt = select(UserModel).where(UserModel.username == username)
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                return None
            return UserRecord(
                id=row.id,
                username=row.username,
                user_id=row.user_id,
                email=row.email,
                password_hash=row.password_hash,
                role=row.role,
                stripe_customer_id=row.stripe_customer_id,
            )

    def get_by_user_id(self, user_id: str) -> UserRecord | None:
        with self._session_factory() as session:
            stmt = select(UserModel).where(UserModel.user_id == user_id)
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                return None
            return UserRecord(
                id=row.id,
                username=row.username,
                user_id=row.user_id,
                email=row.email,
                password_hash=row.password_hash,
                role=row.role,
                stripe_customer_id=row.stripe_customer_id,
            )

    def get_by_email(self, email: str) -> UserRecord | None:
        with self._session_factory() as session:
            stmt = select(UserModel).where(UserModel.email == email)
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                return None
            return UserRecord(
                id=row.id,
                username=row.username,
                user_id=row.user_id,
                email=row.email,
                password_hash=row.password_hash,
                role=row.role,
                stripe_customer_id=row.stripe_customer_id,
            )

    def get_by_id(self, user_id: str) -> UserRecord | None:
        with self._session_factory() as session:
            row = session.get(UserModel, user_id)
            if row is None:
                return None
            return UserRecord(
                id=row.id,
                username=row.username,
                user_id=row.user_id,
                email=row.email,
                password_hash=row.password_hash,
                role=row.role,
                stripe_customer_id=row.stripe_customer_id,
            )

    def get_by_stripe_customer_id(self, stripe_customer_id: str) -> UserRecord | None:
        with self._session_factory() as session:
            stmt = select(UserModel).where(UserModel.stripe_customer_id == stripe_customer_id)
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                return None
            return UserRecord(
                id=row.id,
                username=row.username,
                user_id=row.user_id,
                email=row.email,
                password_hash=row.password_hash,
                role=row.role,
                stripe_customer_id=row.stripe_customer_id,
            )

    def create_user(
        self,
        user_id: str,
        email: str,
        password_hash: str,
        role: str,
        username: str | None = None,
    ) -> UserRecord:
        with self._session_factory() as session:
            model = UserModel(
                username=username or email,
                user_id=user_id,
                email=email,
                password_hash=password_hash,
                role=role,
            )
            session.add(model)
            try:
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError("user_exists") from exc
            return UserRecord(
                id=model.id,
                username=model.username,
                user_id=model.user_id,
                email=model.email,
                password_hash=model.password_hash,
                role=model.role,
                stripe_customer_id=model.stripe_customer_id,
            )

    def set_stripe_customer_id(self, user_id: str, stripe_customer_id: str) -> UserRecord:
        with self._session_factory() as session:
            model = session.get(UserModel, user_id)
            if model is None:
                raise ValueError("user_not_found")
            model.stripe_customer_id = stripe_customer_id
            try:
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError("stripe_customer_exists") from exc
            session.refresh(model)
            return UserRecord(
                id=model.id,
                username=model.username,
                user_id=model.user_id,
                email=model.email,
                password_hash=model.password_hash,
                role=model.role,
                stripe_customer_id=model.stripe_customer_id,
            )

    def delete_by_username(self, username: str) -> None:
        with self._session_factory() as session:
            stmt = select(UserModel).where(UserModel.username == username)
            model = session.execute(stmt).scalar_one_or_none()
            if model is None:
                return
            session.delete(model)
            session.commit()

    def delete_by_user_id(self, user_id: str) -> None:
        with self._session_factory() as session:
            stmt = select(UserModel).where(UserModel.user_id == user_id)
            model = session.execute(stmt).scalar_one_or_none()
            if model is None:
                return
            session.delete(model)
            session.commit()
