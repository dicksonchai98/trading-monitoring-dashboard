"""Auth and RBAC dependencies shared by REST and SSE endpoints."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services.token_service import TokenError
from app.state import audit_log, auth_service, metrics


@dataclass
class Principal:
    username: str
    role: str


logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


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
