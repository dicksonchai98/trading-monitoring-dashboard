from __future__ import annotations

from app.models.analytics_job import AnalyticsJobModel
from app.models.batch_job import BatchJobModel
from app.models.bidask_metric_1s import BidAskMetric1sModel
from app.models.billing_event import BillingEventModel
from app.models.billing_plan import BillingPlanModel
from app.models.email_delivery_log import EmailDeliveryLogModel
from app.models.email_outbox import EmailOutboxModel
from app.models.index_contribution_ranking_1m import IndexContributionRanking1mModel
from app.models.index_contribution_snapshot_1m import IndexContributionSnapshot1mModel
from app.models.kbar_1m import Kbar1mModel
from app.models.kbar_daily_feature import KbarDailyFeatureModel
from app.models.kbar_distribution_stat import KbarDistributionStatModel
from app.models.kbar_event_sample import KbarEventSampleModel
from app.models.kbar_event_stat import KbarEventStatModel
from app.models.market_summary_1m import MarketSummary1mModel
from app.models.otp_challenge import OtpChallengeModel
from app.models.otp_verification_token import OtpVerificationTokenModel
from app.models.quote_feature_1m import QuoteFeature1mModel
from app.models.refresh_denylist import RefreshTokenDenylistModel
from app.models.sector_contribution_snapshot_1m import SectorContributionSnapshot1mModel
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


def test_billing_plan_model_table_name() -> None:
    assert BillingPlanModel.__tablename__ == "billing_plans"


def test_kbar_1m_model_table_name() -> None:
    assert Kbar1mModel.__tablename__ == "kbars_1m"


def test_kbar_analytics_table_names() -> None:
    assert KbarDailyFeatureModel.__tablename__ == "kbar_daily_features"
    assert KbarEventSampleModel.__tablename__ == "kbar_event_samples"
    assert KbarEventStatModel.__tablename__ == "kbar_event_stats"
    assert KbarDistributionStatModel.__tablename__ == "kbar_distribution_stats"
    assert AnalyticsJobModel.__tablename__ == "analytics_jobs"


def test_kbar_analytics_job_has_retry_counter() -> None:
    assert "retry_count" in AnalyticsJobModel.__table__.columns


def test_bidask_metric_1s_model_table_name() -> None:
    assert BidAskMetric1sModel.__tablename__ == "bidask_metrics_1s"


def test_quote_feature_1m_model_table_name() -> None:
    assert QuoteFeature1mModel.__tablename__ == "quote_features_1m"


def test_bidask_metric_1s_model_includes_event_second_identity() -> None:
    columns = BidAskMetric1sModel.__table__.columns.keys()
    assert "event_second" in columns
    constraints = {
        constraint.name
        for constraint in BidAskMetric1sModel.__table__.constraints
        if getattr(constraint, "name", None)
    }
    assert "uq_bidask_metrics_1s_code_event_second" in constraints


def test_market_summary_1m_model_table_name() -> None:
    assert MarketSummary1mModel.__tablename__ == "market_summary_1m"


def test_kbar_and_market_summary_models_include_extension_columns() -> None:
    kbar_columns = Kbar1mModel.__table__.columns.keys()
    market_columns = MarketSummary1mModel.__table__.columns.keys()
    assert "amplitude" in kbar_columns
    assert "amplitude_pct" in kbar_columns
    assert "futures_code" in market_columns
    assert "futures_price" in market_columns
    assert "spread" in market_columns
    assert "spread_day_high" in market_columns
    assert "spread_day_low" in market_columns
    assert "spread_strength" in market_columns
    assert "spread_status" in market_columns
    assert "yesterday_estimated_turnover" in market_columns
    assert "estimated_turnover_diff" in market_columns
    assert "estimated_turnover_ratio" in market_columns


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


def test_index_contribution_models_table_names() -> None:
    assert IndexContributionSnapshot1mModel.__tablename__ == "index_contribution_snapshot_1m"
    assert IndexContributionRanking1mModel.__tablename__ == "index_contribution_ranking_1m"
    assert SectorContributionSnapshot1mModel.__tablename__ == "sector_contribution_snapshot_1m"
