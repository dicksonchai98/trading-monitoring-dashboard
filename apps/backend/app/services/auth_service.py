"""Auth service for register, login, and refresh flows."""

from __future__ import annotations

from typing import Any

from app.config import ACCESS_TOKEN_TTL_SECONDS, JWT_SECRET, REFRESH_TOKEN_TTL_SECONDS
from app.repositories.user_repository import UserRecord, UserRepository
from app.security.passwords import hash_password, verify_password
from app.services.denylist import RefreshDenylist
from app.services.metrics import Metrics
from app.services.token_service import TokenError, issue_token, verify_token

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


class AuthService:
    def __init__(
        self, user_repository: UserRepository, denylist: RefreshDenylist, metrics: Metrics
    ) -> None:
        self._user_repository = user_repository
        self._denylist = denylist
        self._metrics = metrics

    def register(self, user_id: str, email: str, password: str) -> tuple[str, str]:
        password_hash = hash_password(password)
        try:
            user = self._user_repository.create_user(
                user_id=user_id,
                email=email,
                password_hash=password_hash,
                role="user",
            )
        except ValueError as err:
            if str(err) == "user_exists":
                raise
            raise ValueError("user_exists") from err
        return self._mint_pair(user)

    @staticmethod
    def is_valid_email(email: str) -> bool:
        local_domain = email.split("@")
        return len(local_domain) == 2 and bool(local_domain[0]) and bool(local_domain[1])

    @staticmethod
    def is_valid_user_id(user_id: str) -> bool:
        trimmed = user_id.strip()
        return len(trimmed) >= 3 and len(trimmed) <= 64

    @staticmethod
    def is_valid_password(password: str) -> bool:
        if len(password) < 5:
            return False
        has_non_alpha = any(not ch.isalpha() for ch in password)
        return has_non_alpha

    def email_exists(self, email: str) -> bool:
        return self._user_repository.get_by_email(email) is not None

    def user_id_exists(self, user_id: str) -> bool:
        return self._user_repository.get_by_user_id(user_id) is not None

    def delete_user(self, user_id: str) -> None:
        self._user_repository.delete_by_user_id(user_id)

    def login(self, user_id: str, password: str) -> tuple[str, str]:
        user = self._user_repository.get_by_user_id(user_id)
        if user is None:
            user = self._user_repository.get_by_username(user_id)
        if user is None or not verify_password(password, user.password_hash):
            self._metrics.inc("login_failure")
            raise ValueError("invalid_credentials")
        self._metrics.inc("login_success")
        return self._mint_pair(user)

    def refresh(self, refresh_token: str) -> tuple[str, str]:
        try:
            payload = verify_token(refresh_token, JWT_SECRET, expected_type=REFRESH_TOKEN_TYPE)
        except TokenError:
            self._metrics.inc("refresh_failure")
            raise

        old_jti = str(payload["jti"])
        if self._denylist.contains(old_jti):
            self._metrics.inc("refresh_denylist_hit")
            self._metrics.inc("refresh_failure")
            raise TokenError("denylisted")

        user = self._user_repository.get_by_username(str(payload["sub"]))
        if user is None:
            self._metrics.inc("refresh_failure")
            raise TokenError("tampered")

        self._denylist.add(old_jti, int(payload["exp"]))
        self._metrics.inc("refresh_success")
        return self._mint_pair(user)

    def logout(self, refresh_token: str | None) -> None:
        if not refresh_token:
            return
        try:
            payload = verify_token(refresh_token, JWT_SECRET, expected_type=REFRESH_TOKEN_TYPE)
        except TokenError:
            return

        jti = str(payload["jti"])
        if self._denylist.contains(jti):
            return
        self._denylist.add(jti, int(payload["exp"]))
        self._metrics.inc("logout_success")

    def verify_access_token(self, token: str) -> dict[str, Any]:
        return verify_token(token, JWT_SECRET, expected_type=ACCESS_TOKEN_TYPE)

    def _mint_pair(self, user: UserRecord) -> tuple[str, str]:
        claims = {"sub": user.username, "user_id": user.user_id, "role": user.role}
        access_token = issue_token(
            claims,
            ACCESS_TOKEN_TTL_SECONDS,
            JWT_SECRET,
            token_type=ACCESS_TOKEN_TYPE,
        )
        refresh_token = issue_token(
            claims,
            REFRESH_TOKEN_TTL_SECONDS,
            JWT_SECRET,
            token_type=REFRESH_TOKEN_TYPE,
        )
        return access_token, refresh_token
