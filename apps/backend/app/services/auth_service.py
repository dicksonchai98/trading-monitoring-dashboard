"""Auth service for register, login, and refresh flows."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.config import ACCESS_TOKEN_TTL_SECONDS, JWT_SECRET, REFRESH_TOKEN_TTL_SECONDS
from app.services.denylist import RefreshDenylist
from app.services.metrics import Metrics
from app.services.token_service import TokenError, issue_token, verify_token


@dataclass
class User:
    username: str
    password: str
    role: str


class AuthService:
    def __init__(self, denylist: RefreshDenylist, metrics: Metrics) -> None:
        self._denylist = denylist
        self._metrics = metrics
        self._users: dict[str, User] = {
            "admin": User(username="admin", password="admin-pass", role="admin")
        }

    def register(self, username: str, password: str) -> tuple[str, str]:
        if username in self._users:
            raise ValueError("user_exists")
        self._users[username] = User(username=username, password=password, role="user")
        return self._mint_pair(self._users[username])

    def login(self, username: str, password: str) -> tuple[str, str]:
        user = self._users.get(username)
        if user is None or user.password != password:



            
            self._metrics.inc("login_failure")
            raise ValueError("invalid_credentials")
        self._metrics.inc("login_success")
        return self._mint_pair(user)

    def refresh(self, refresh_token: str) -> tuple[str, str]:
        try:
            payload = verify_token(refresh_token, JWT_SECRET, expected_type="refresh")
        except TokenError:
            self._metrics.inc("refresh_failure")
            raise

        old_jti = str(payload["jti"])
        if self._denylist.contains(old_jti):
            self._metrics.inc("refresh_denylist_hit")
            self._metrics.inc("refresh_failure")
            raise TokenError("denylisted")

        user = self._users.get(str(payload["sub"]))
        if user is None:
            self._metrics.inc("refresh_failure")
            raise TokenError("tampered")

        self._denylist.add(old_jti, int(payload["exp"]))
        self._metrics.inc("refresh_success")
        return self._mint_pair(user)

    def verify_access_token(self, token: str) -> dict[str, Any]:
        return verify_token(token, JWT_SECRET, expected_type="access")

    def _mint_pair(self, user: User) -> tuple[str, str]:
        claims = {"sub": user.username, "role": user.role}
        access_token = issue_token(claims, ACCESS_TOKEN_TTL_SECONDS, JWT_SECRET, token_type="access")
        refresh_token = issue_token(claims, REFRESH_TOKEN_TTL_SECONDS, JWT_SECRET, token_type="refresh")
        return access_token, refresh_token

