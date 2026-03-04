from __future__ import annotations

from app.models.billing_event import BillingEventModel
from app.models.refresh_denylist import RefreshTokenDenylistModel
from app.models.subscription import SubscriptionModel
from app.models.user import UserModel


def test_user_model_table_name() -> None:
    assert UserModel.__tablename__ == "users"


def test_refresh_denylist_model_table_name() -> None:
    assert RefreshTokenDenylistModel.__tablename__ == "refresh_token_denylist"


def test_subscription_model_table_name() -> None:
    assert SubscriptionModel.__tablename__ == "subscriptions"


def test_billing_event_model_table_name() -> None:
    assert BillingEventModel.__tablename__ == "billing_events"
