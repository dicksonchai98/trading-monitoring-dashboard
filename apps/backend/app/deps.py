"""Auth and RBAC dependencies shared by REST and SSE endpoints."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import SERVING_RATE_LIMIT_PER_MIN, SERVING_SSE_CONN_LIMIT
from app.services.token_service import TokenError
from app.state import audit_log, auth_service, metrics, serving_rate_limiter


@dataclass
class Principal:
    username: str
    role: str


logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return "unknown"


def _extract_bearer_token(
    authorization: str | None, credentials: HTTPAuthorizationCredentials | None
) -> str:
    if authorization is None:
        metrics.inc("authorization_denied")

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_authorization"
        )
    if credentials is None:
        metrics.inc("authorization_denied")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_authorization"
        )
    return credentials.credentials


def require_authenticated(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Principal:
    authorization = request.headers.get("authorization")
    path = request.url.path
    is_weighted_sse = path.startswith("/realtime/weighted")
    token = _extract_bearer_token(authorization, credentials)
    try:
        payload = auth_service.verify_access_token(token)
    except TokenError as err:
        metrics.inc("authorization_denied")
        if is_weighted_sse:
            metrics.inc("sse_auth_failure")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err.reason,
        ) from err

    return Principal(username=str(payload["sub"]), role=str(payload["role"]))


def require_user_or_admin(
    request: Request,
    principal: Principal = Depends(require_authenticated),
) -> Principal:
    path = request.url.path
    is_weighted_sse = path.startswith("/realtime/weighted")
    if principal.role not in {"user", "admin"}:
        metrics.inc("authorization_denied")
        if is_weighted_sse:
            metrics.inc("sse_auth_failure")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_role")
    return principal


def require_admin(
    request: Request,
    principal: Principal = Depends(require_authenticated),
) -> Principal:
    if principal.role != "admin":
        metrics.inc("authorization_denied")
        audit_log.record(
            event_type="admin_access_denied",
            path=request.url.path,
            actor=principal.username,
            role=principal.role,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_role")
    return principal


def enforce_serving_rate_limit(request: Request) -> None:
    key = _client_key(request)
    if not serving_rate_limiter.allow_request(key, SERVING_RATE_LIMIT_PER_MIN, window_seconds=60):
        metrics.inc("serving_rate_limit_denied")
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate_limited")


def try_open_sse_slot(request: Request) -> str:
    key = _client_key(request)
    if not serving_rate_limiter.try_open_sse(key, SERVING_SSE_CONN_LIMIT):
        metrics.inc("serving_rate_limit_denied")
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="sse_limit")
    return key


async def record_serving_latency() -> None:
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        metrics.set_gauge("serving_rest_latency_ms", elapsed_ms)
