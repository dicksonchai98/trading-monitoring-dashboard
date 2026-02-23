"""Application state and singleton services."""

from __future__ import annotations

from sqlalchemy import delete

from app.db.session import SessionLocal
from app.models.refresh_denylist import RefreshTokenDenylistModel
from app.models.user import UserModel
from app.repositories.refresh_denylist_repository import RefreshDenylistRepository
from app.repositories.user_repository import UserRepository
from app.services.audit import AuditLog
from app.services.auth_service import AuthService
from app.services.denylist import RefreshDenylist
from app.services.metrics import Metrics

user_repository = UserRepository(session_factory=SessionLocal)
refresh_denylist_repository = RefreshDenylistRepository(session_factory=SessionLocal)
metrics = Metrics()
denylist = RefreshDenylist(repo=refresh_denylist_repository)
audit_log = AuditLog()
auth_service = AuthService(user_repository=user_repository, denylist=denylist, metrics=metrics)


def reset_state_for_tests() -> None:
    metrics.counters = {k: 0 for k in metrics.counters}
    audit_log.events.clear()
    with SessionLocal() as session:
        session.execute(delete(RefreshTokenDenylistModel))
        session.execute(delete(UserModel))
        session.commit()
