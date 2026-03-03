"""Application state and singleton services."""

from __future__ import annotations

from sqlalchemy import delete

from app.config import get_stripe_settings
from app.db.session import SessionLocal
from app.models.billing_event import BillingEventModel
from app.models.refresh_denylist import RefreshTokenDenylistModel
from app.models.subscription import SubscriptionModel
from app.models.user import UserModel
from app.repositories.billing_event_repository import BillingEventRepository
from app.repositories.refresh_denylist_repository import RefreshDenylistRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.user_repository import UserRepository
from app.services.audit import AuditLog
from app.services.auth_service import AuthService
from app.services.billing_service import BillingService
from app.services.denylist import RefreshDenylist
from app.services.metrics import Metrics
from app.services.stripe_provider import StripeProvider

user_repository = UserRepository(session_factory=SessionLocal)
refresh_denylist_repository = RefreshDenylistRepository(session_factory=SessionLocal)
subscription_repository = SubscriptionRepository(session_factory=SessionLocal)
billing_event_repository = BillingEventRepository(session_factory=SessionLocal)
metrics = Metrics()
denylist = RefreshDenylist(repo=refresh_denylist_repository)
audit_log = AuditLog()
auth_service = AuthService(user_repository=user_repository, denylist=denylist, metrics=metrics)
billing_service = BillingService(
    settings=get_stripe_settings(),
    user_repository=user_repository,
    subscription_repository=subscription_repository,
    billing_event_repository=billing_event_repository,
    audit_log=audit_log,
    stripe_provider=StripeProvider(secret_key=get_stripe_settings().secret_key),
)


def reset_state_for_tests() -> None:
    metrics.counters = {k: 0 for k in metrics.counters}
    audit_log.events.clear()
    with SessionLocal() as session:
        session.execute(delete(BillingEventModel))
        session.execute(delete(SubscriptionModel))
        session.execute(delete(RefreshTokenDenylistModel))
        session.execute(delete(UserModel))
        session.commit()
