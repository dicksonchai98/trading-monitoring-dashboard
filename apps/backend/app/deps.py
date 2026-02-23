"""Auth and RBAC dependencies shared by REST and SSE endpoints."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, Request, status

from app.services.token_service import TokenError
from app.state import audit_log, auth_service, metrics


@dataclass
class Principal:
    username: str
    role: str


def _extract_bearer_token(authorization: str | None) -> str:
    if authorization is None:
        metrics.inc("authorization_denied")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_authorization")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        metrics.inc("authorization_denied")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_authorization")
    return parts[1]


def require_authenticated(
    request: Request,
    authorization: str | None = Header(default=None),
) -> Principal:
    token = _extract_bearer_token(authorization)
    try:
        payload = auth_service.verify_access_token(token)
    except TokenError as err:
        metrics.inc("authorization_denied")
        if request.url.path.startswith("/realtime/weighted"):
            metrics.inc("sse_auth_failure")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=err.reason)

    return Principal(username=str(payload["sub"]), role=str(payload["role"]))


def require_user_or_admin(
    request: Request,
    principal: Principal = Depends(require_authenticated),
) -> Principal:
    if principal.role not in {"user", "admin"}:
        metrics.inc("authorization_denied")
        if request.url.path.startswith("/realtime/weighted"):
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
