from __future__ import annotations

from app.models.batch_job import BatchJobModel
from app.models.bidask_metric_1s import BidAskMetric1sModel
from app.models.billing_event import BillingEventModel
from app.models.email_delivery_log import EmailDeliveryLogModel
from app.models.email_outbox import EmailOutboxModel
from app.models.kbar_1m import Kbar1mModel
from app.models.otp_challenge import OtpChallengeModel
from app.models.otp_verification_token import OtpVerificationTokenModel
from app.models.refresh_denylist import RefreshTokenDenylistModel
from app.models.subscription import SubscriptionModel
from app.models.user import UserModel
from app.modules.batch_shared.jobs.interfaces import JobStatus


def test_user_model_table_name() -> None:
    assert UserModel.__tablename__ == "users"


def test_refresh_denylist_model_table_name() -> None:
    assert RefreshTokenDenylistModel.__tablename__ == "refresh_token_denylist"


def test_subscription_model_table_name() -> None:
    assert SubscriptionModel.__tablename__ == "subscriptions"


def test_billing_event_model_table_name() -> None:
    assert BillingEventModel.__tablename__ == "billing_events"


def test_kbar_1m_model_table_name() -> None:
    assert Kbar1mModel.__tablename__ == "kbars_1m"


def test_bidask_metric_1s_model_table_name() -> None:
    assert BidAskMetric1sModel.__tablename__ == "bidask_metrics_1s"


def test_batch_job_status_column_allows_longest_status_value() -> None:
    assert BatchJobModel.__table__.c.status.type.length >= len(JobStatus.PARTIALLY_COMPLETED.value)


def test_batch_job_model_includes_worker_type_and_dedupe_key() -> None:
    columns = BatchJobModel.__table__.columns.keys()
    assert "worker_type" in columns
    assert "dedupe_key" in columns


def test_otp_and_outbox_tables_exist() -> None:
    assert OtpChallengeModel.__tablename__ == "otp_challenges"
    assert OtpVerificationTokenModel.__tablename__ == "otp_verification_tokens"
    assert EmailOutboxModel.__tablename__ == "email_outbox"
    assert EmailDeliveryLogModel.__tablename__ == "email_delivery_logs"


def test_otp_and_outbox_enum_values_match_contract() -> None:
    otp_status_enum = OtpChallengeModel.__table__.c.status.type
    outbox_type_enum = EmailOutboxModel.__table__.c.email_type.type
    outbox_status_enum = EmailOutboxModel.__table__.c.status.type
    assert otp_status_enum.enums == ["pending", "verified", "expired", "locked", "consumed"]
    assert outbox_type_enum.enums == ["otp", "notification"]
    assert outbox_status_enum.enums == ["pending", "processing", "sent", "failed"]


def test_email_outbox_has_unique_idempotency_index() -> None:
    indexes = {
        index.name: sorted(index.columns.keys()) for index in EmailOutboxModel.__table__.indexes
    }
    assert "ix_email_outbox_idempotency_key" in indexes
    assert indexes["ix_email_outbox_idempotency_key"] == ["idempotency_key"]
