"""Application state and singleton services."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import delete

from app.config import (
    AGGREGATOR_BIDASK_CONSUMER,
    AGGREGATOR_BIDASK_GROUP,
    AGGREGATOR_BLOCK_MS,
    AGGREGATOR_BLOCKING_WARN_MS,
    AGGREGATOR_CLAIM_COUNT,
    AGGREGATOR_CLAIM_IDLE_MS,
    AGGREGATOR_CODE,
    AGGREGATOR_DB_SINK_BATCH_SIZE,
    AGGREGATOR_DB_SINK_DEAD_LETTER_MAXLEN,
    AGGREGATOR_DB_SINK_MAX_RETRIES,
    AGGREGATOR_DB_SINK_RETRY_BACKOFF_SECONDS,
    AGGREGATOR_ENV,
    AGGREGATOR_READ_COUNT,
    AGGREGATOR_SERIES_FIELDS,
    AGGREGATOR_STATE_TTL_SECONDS,
    AGGREGATOR_TICK_CONSUMER,
    AGGREGATOR_TICK_GROUP,
    AGGREGATOR_WORKER_ROLE,
    INGESTOR_QUEUE_MAXSIZE,
    INGESTOR_REDIS_RETRY_ATTEMPTS,
    INGESTOR_REDIS_RETRY_BACKOFF_MS,
    INGESTOR_STREAM_MAXLEN,
    LATEST_STATE_BLOCK_MS,
    LATEST_STATE_CLAIM_COUNT,
    LATEST_STATE_CLAIM_IDLE_MS,
    LATEST_STATE_CONSUMER,
    LATEST_STATE_ENV,
    LATEST_STATE_FLUSH_BATCH_SIZE,
    LATEST_STATE_FLUSH_INTERVAL_MS,
    LATEST_STATE_GROUP,
    LATEST_STATE_READ_COUNT,
    LATEST_STATE_TTL_SECONDS,
    QUOTE_WORKER_CONSUMER_NAME,
    QUOTE_WORKER_DB_FLUSH_ENABLED,
    QUOTE_WORKER_GROUP,
    QUOTE_WORKER_REDIS_RETRY_ATTEMPTS,
    QUOTE_WORKER_REDIS_RETRY_BACKOFF_MS,
    QUOTE_WORKER_STREAM_MAXLEN,
    QUOTE_WORKER_TARGET_CODE,
    MARKET_ADJUSTMENT_FACTOR,
    MARKET_BLOCK_MS,
    MARKET_CLAIM_COUNT,
    MARKET_CLAIM_IDLE_MS,
    MARKET_CODE,
    MARKET_CONSUMER_NAME,
    MARKET_DB_SINK_BATCH_SIZE,
    MARKET_DB_SINK_DEAD_LETTER_MAXLEN,
    MARKET_DB_SINK_MAX_RETRIES,
    MARKET_DB_SINK_RETRY_BACKOFF_SECONDS,
    MARKET_GROUP,
    MARKET_READ_COUNT,
    MARKET_SPREAD_FRESHNESS_SECONDS,
    MARKET_SPREAD_FUTURES_CODE,
    MARKET_STATE_TTL_SECONDS,
    MARKET_SUMMARY_ENV,
    MARKET_TRADING_END,
    MARKET_TRADING_START,
    OTC_SUMMARY_BLOCK_MS,
    OTC_SUMMARY_CLAIM_COUNT,
    OTC_SUMMARY_CLAIM_IDLE_MS,
    OTC_SUMMARY_CODE,
    OTC_SUMMARY_CONSUMER_NAME,
    OTC_SUMMARY_ENV,
    OTC_SUMMARY_GROUP,
    OTC_SUMMARY_READ_COUNT,
    OTC_SUMMARY_STATE_TTL_SECONDS,
    REDIS_URL,
    get_stripe_settings,
)
from app.db.session import SessionLocal
from app.latest_state.runner import LatestStateRunner
from app.market_ingestion.runner import MarketIngestionRunner
from app.market_summary.runner import MarketSummaryRunner
from app.models.batch_job import BatchJobModel
from app.models.bidask_metric_1s import BidAskMetric1sModel
from app.models.billing_event import BillingEventModel
from app.models.email_delivery_log import EmailDeliveryLogModel
from app.models.email_outbox import EmailOutboxModel
from app.models.kbar_1m import Kbar1mModel
from app.models.market_summary_1m import MarketSummary1mModel
from app.models.otp_challenge import OtpChallengeModel
from app.models.otp_verification_token import OtpVerificationTokenModel
from app.models.quote_feature_1m import QuoteFeature1mModel
from app.models.refresh_denylist import RefreshTokenDenylistModel
from app.models.subscription import SubscriptionModel
from app.models.user import UserModel
from app.otc_summary.runner import OtcSummaryRunner
from app.quote_processing.runner import QuoteWorkerRunner
from app.repositories.billing_event_repository import BillingEventRepository
from app.repositories.email_delivery_log_repository import EmailDeliveryLogRepository
from app.repositories.email_outbox_repository import EmailOutboxRepository
from app.repositories.otp_challenge_repository import OtpChallengeRepository
from app.repositories.otp_verification_token_repository import OtpVerificationTokenRepository
from app.repositories.refresh_denylist_repository import RefreshDenylistRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.user_repository import UserRepository
from app.services.audit import AuditLog
from app.services.auth_service import AuthService
from app.services.billing_service import BillingService
from app.services.denylist import RefreshDenylist
from app.services.email_outbox_dispatcher import EmailOutboxDispatcher
from app.services.email_webhook_service import EmailWebhookService
from app.services.metrics import Metrics
from app.services.notification_email_service import NotificationEmailService
from app.services.otp_service import OtpService
from app.services.rate_limiter import SimpleRateLimiter
from app.services.shioaji_session import build_shioaji_client
from app.services.stripe_provider import StripeProvider
from app.stream_processing.runner import StreamProcessingRunner

logger = logging.getLogger(__name__)

user_repository = UserRepository(session_factory=SessionLocal)
refresh_denylist_repository = RefreshDenylistRepository(session_factory=SessionLocal)
subscription_repository = SubscriptionRepository(session_factory=SessionLocal)
billing_event_repository = BillingEventRepository(session_factory=SessionLocal)
otp_challenge_repository = OtpChallengeRepository(session_factory=SessionLocal)
otp_verification_token_repository = OtpVerificationTokenRepository(session_factory=SessionLocal)
email_outbox_repository = EmailOutboxRepository(session_factory=SessionLocal)
email_delivery_log_repository = EmailDeliveryLogRepository(session_factory=SessionLocal)
metrics = Metrics()
denylist = RefreshDenylist(repo=refresh_denylist_repository)
audit_log = AuditLog()
auth_service = AuthService(user_repository=user_repository, denylist=denylist, metrics=metrics)
otp_service = OtpService(
    user_repository=user_repository,
    challenge_repository=otp_challenge_repository,
    token_repository=otp_verification_token_repository,
    outbox_repository=email_outbox_repository,
    rate_limiter=SimpleRateLimiter(),
)
billing_service = BillingService(
    settings=get_stripe_settings(),
    user_repository=user_repository,
    subscription_repository=subscription_repository,
    billing_event_repository=billing_event_repository,
    audit_log=audit_log,
    stripe_provider=StripeProvider(secret_key=get_stripe_settings().secret_key),
)
serving_rate_limiter = SimpleRateLimiter()
ingestor_runner: MarketIngestionRunner | None = None
aggregator_runner: StreamProcessingRunner | None = None
latest_state_runner: LatestStateRunner | None = None
market_summary_runner: MarketSummaryRunner | None = None
otc_summary_runner: OtcSummaryRunner | None = None
serving_redis_client = None
email_outbox_dispatcher: EmailOutboxDispatcher | None = None
email_webhook_service = EmailWebhookService(
    outbox_repository=email_outbox_repository,
    delivery_log_repository=email_delivery_log_repository,
)
notification_email_service = NotificationEmailService(
    outbox_repository=email_outbox_repository,
)


def _normalize_aggregator_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in {"all", "tick", "bidask"}:
        raise RuntimeError("invalid AGGREGATOR_WORKER_ROLE, expected one of: all, tick, bidask")
    return normalized


def _build_aggregator_runner_for_role(role: str, redis_module: Any) -> StreamProcessingRunner:
    normalized = _normalize_aggregator_role(role)
    enable_tick = normalized in {"all", "tick"}
    enable_bidask = normalized in {"all", "bidask"}
    runner = StreamProcessingRunner(
        redis_client=redis_module.from_url(REDIS_URL),
        session_factory=SessionLocal,
        metrics=metrics,
        env=AGGREGATOR_ENV,
        code=AGGREGATOR_CODE,
        tick_group=AGGREGATOR_TICK_GROUP,
        bidask_group=AGGREGATOR_BIDASK_GROUP,
        tick_consumer=AGGREGATOR_TICK_CONSUMER,
        bidask_consumer=AGGREGATOR_BIDASK_CONSUMER,
        read_count=AGGREGATOR_READ_COUNT,
        block_ms=AGGREGATOR_BLOCK_MS,
        claim_idle_ms=AGGREGATOR_CLAIM_IDLE_MS,
        claim_count=AGGREGATOR_CLAIM_COUNT,
        ttl_seconds=AGGREGATOR_STATE_TTL_SECONDS,
        series_fields=AGGREGATOR_SERIES_FIELDS,
        db_sink_batch_size=AGGREGATOR_DB_SINK_BATCH_SIZE,
        db_sink_retry_backoff_seconds=AGGREGATOR_DB_SINK_RETRY_BACKOFF_SECONDS,
        db_sink_max_retries=AGGREGATOR_DB_SINK_MAX_RETRIES,
        db_sink_dead_letter_maxlen=AGGREGATOR_DB_SINK_DEAD_LETTER_MAXLEN,
        blocking_warn_ms=AGGREGATOR_BLOCKING_WARN_MS,
        enable_tick_pipeline=enable_tick,
        enable_bidask_pipeline=enable_bidask,
    )
    logger.info("aggregator runner created role=%s", normalized)
    return runner


def build_ingestor_runner() -> MarketIngestionRunner:
    global ingestor_runner
    if ingestor_runner is not None:
        return ingestor_runner
    try:
        import redis
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("ingestor dependencies unavailable: install redis and shioaji") from err

    try:
        shioaji_client = build_shioaji_client()
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("ingestor dependencies unavailable: install redis and shioaji") from err

    ingestor_runner = MarketIngestionRunner(
        shioaji_client=shioaji_client,
        redis_client=redis.from_url(REDIS_URL),
        metrics=metrics,
        queue_maxsize=INGESTOR_QUEUE_MAXSIZE,
        stream_maxlen=INGESTOR_STREAM_MAXLEN,
        retry_attempts=INGESTOR_REDIS_RETRY_ATTEMPTS,
        retry_backoff_ms=INGESTOR_REDIS_RETRY_BACKOFF_MS,
    )
    logger.info("ingestor runner created")
    return ingestor_runner


def build_aggregator_runner() -> StreamProcessingRunner:
    global aggregator_runner
    if aggregator_runner is not None:
        return aggregator_runner
    try:
        import redis
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("aggregator dependencies unavailable: install redis") from err

    aggregator_runner = _build_aggregator_runner_for_role(AGGREGATOR_WORKER_ROLE, redis)
    return aggregator_runner


def build_tick_aggregator_runner() -> StreamProcessingRunner:
    try:
        import redis
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("aggregator dependencies unavailable: install redis") from err
    return _build_aggregator_runner_for_role("tick", redis)


def build_bidask_aggregator_runner() -> StreamProcessingRunner:
    try:
        import redis
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("aggregator dependencies unavailable: install redis") from err
    return _build_aggregator_runner_for_role("bidask", redis)


def build_latest_state_runner() -> LatestStateRunner:
    global latest_state_runner
    if latest_state_runner is not None:
        return latest_state_runner
    try:
        import redis
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("latest-state dependencies unavailable: install redis") from err

    latest_state_runner = LatestStateRunner(
        redis_client=redis.from_url(REDIS_URL),
        metrics=metrics,
        env=LATEST_STATE_ENV,
        group=LATEST_STATE_GROUP,
        consumer=LATEST_STATE_CONSUMER,
        read_count=LATEST_STATE_READ_COUNT,
        block_ms=LATEST_STATE_BLOCK_MS,
        claim_idle_ms=LATEST_STATE_CLAIM_IDLE_MS,
        claim_count=LATEST_STATE_CLAIM_COUNT,
        state_ttl_seconds=LATEST_STATE_TTL_SECONDS,
        flush_interval_ms=LATEST_STATE_FLUSH_INTERVAL_MS,
        flush_batch_size=LATEST_STATE_FLUSH_BATCH_SIZE,
    )
    logger.info("latest-state runner created")
    return latest_state_runner


def build_market_summary_runner() -> MarketSummaryRunner:
    global market_summary_runner
    if market_summary_runner is not None:
        return market_summary_runner
    try:
        import redis
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("market-summary dependencies unavailable: install redis") from err

    market_summary_runner = MarketSummaryRunner(
        redis_client=redis.from_url(REDIS_URL),
        session_factory=SessionLocal,
        metrics=metrics,
        env=MARKET_SUMMARY_ENV,
        code=MARKET_CODE,
        group=MARKET_GROUP,
        consumer=MARKET_CONSUMER_NAME,
        read_count=MARKET_READ_COUNT,
        block_ms=MARKET_BLOCK_MS,
        claim_idle_ms=MARKET_CLAIM_IDLE_MS,
        claim_count=MARKET_CLAIM_COUNT,
        ttl_seconds=MARKET_STATE_TTL_SECONDS,
        trading_start=MARKET_TRADING_START,
        trading_end=MARKET_TRADING_END,
        adjustment_factor=MARKET_ADJUSTMENT_FACTOR,
        futures_code=MARKET_SPREAD_FUTURES_CODE,
        spread_freshness_seconds=MARKET_SPREAD_FRESHNESS_SECONDS,
        db_sink_batch_size=MARKET_DB_SINK_BATCH_SIZE,
        db_sink_retry_backoff_seconds=MARKET_DB_SINK_RETRY_BACKOFF_SECONDS,
        db_sink_max_retries=MARKET_DB_SINK_MAX_RETRIES,
        db_sink_dead_letter_maxlen=MARKET_DB_SINK_DEAD_LETTER_MAXLEN,
    )
    logger.info("market-summary runner created")
    return market_summary_runner


def build_otc_summary_runner() -> OtcSummaryRunner:
    global otc_summary_runner
    if otc_summary_runner is not None:
        return otc_summary_runner
    try:
        import redis
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("otc-summary dependencies unavailable: install redis") from err

    otc_summary_runner = OtcSummaryRunner(
        redis_client=redis.from_url(REDIS_URL),
        metrics=metrics,
        env=OTC_SUMMARY_ENV,
        code=OTC_SUMMARY_CODE,
        group=OTC_SUMMARY_GROUP,
        consumer=OTC_SUMMARY_CONSUMER_NAME,
        read_count=OTC_SUMMARY_READ_COUNT,
        block_ms=OTC_SUMMARY_BLOCK_MS,
        claim_idle_ms=OTC_SUMMARY_CLAIM_IDLE_MS,
        claim_count=OTC_SUMMARY_CLAIM_COUNT,
        ttl_seconds=OTC_SUMMARY_STATE_TTL_SECONDS,
    )
    logger.info("otc-summary runner created")
    return otc_summary_runner


def get_serving_redis_client():
    global serving_redis_client
    if serving_redis_client is not None:
        return serving_redis_client
    try:
        import redis
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("serving dependencies unavailable: install redis") from err
    serving_redis_client = redis.from_url(REDIS_URL)
    return serving_redis_client


def get_email_outbox_dispatcher() -> EmailOutboxDispatcher:
    global email_outbox_dispatcher
    if email_outbox_dispatcher is not None:
        return email_outbox_dispatcher
    try:
        import redis
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("email dispatcher dependencies unavailable: install redis") from err
    email_outbox_dispatcher = EmailOutboxDispatcher(
        redis_client=redis.from_url(REDIS_URL),
        outbox_repository=email_outbox_repository,
    )
    return email_outbox_dispatcher


def reset_state_for_tests() -> None:
    global email_outbox_dispatcher
    metrics.counters = dict.fromkeys(metrics.counters, 0)
    audit_log.events.clear()
    otp_service.reset_rate_limits()
    email_outbox_dispatcher = None
    with SessionLocal() as session:
        session.execute(delete(EmailDeliveryLogModel))
        session.execute(delete(EmailOutboxModel))
        session.execute(delete(OtpVerificationTokenModel))
        session.execute(delete(OtpChallengeModel))
        session.execute(delete(BatchJobModel))
        session.execute(delete(BidAskMetric1sModel))
        session.execute(delete(BillingEventModel))
        session.execute(delete(Kbar1mModel))
        session.execute(delete(SubscriptionModel))
        session.execute(delete(RefreshTokenDenylistModel))
        session.execute(delete(UserModel))
        session.commit()
