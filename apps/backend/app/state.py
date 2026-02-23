"""Application state and singleton services."""

from __future__ import annotations

from app.services.audit import AuditLog
from app.services.auth_service import AuthService
from app.services.denylist import RefreshDenylist
from app.services.metrics import Metrics

metrics = Metrics()
denylist = RefreshDenylist()
audit_log = AuditLog()
auth_service = AuthService(denylist=denylist, metrics=metrics)

