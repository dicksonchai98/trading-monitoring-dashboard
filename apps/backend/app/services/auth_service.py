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

    def register(self, username: str, password: str) -> tuple[str, str]:
        password_hash = hash_password(password)
        try:
            user = self._user_repository.create_user(
                username=username, password_hash=password_hash, role="user"
            )
        except ValueError as err:
            if str(err) == "user_exists":
                raise
            raise ValueError("user_exists") from err
        return self._mint_pair(user)

    def login(self, username: str, password: str) -> tuple[str, str]:
        user = self._user_repository.get_by_username(username)
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

    def verify_access_token(self, token: str) -> dict[str, Any]:
        return verify_token(token, JWT_SECRET, expected_type=ACCESS_TOKEN_TYPE)

    def _mint_pair(self, user: UserRecord) -> tuple[str, str]:
        claims = {"sub": user.username, "role": user.role}
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
