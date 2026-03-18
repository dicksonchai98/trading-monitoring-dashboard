"""Application state and singleton services."""

from __future__ import annotations

import logging

from sqlalchemy import delete

from app.config import (
    AGGREGATOR_BIDASK_CONSUMER,
    AGGREGATOR_BIDASK_GROUP,
    AGGREGATOR_BLOCK_MS,
    AGGREGATOR_CLAIM_COUNT,
    AGGREGATOR_CLAIM_IDLE_MS,
    AGGREGATOR_CODE,
    AGGREGATOR_ENV,
    AGGREGATOR_READ_COUNT,
    AGGREGATOR_SERIES_FIELDS,
    AGGREGATOR_STATE_TTL_SECONDS,
    AGGREGATOR_TICK_CONSUMER,
    AGGREGATOR_TICK_GROUP,
    INGESTOR_QUEUE_MAXSIZE,
    INGESTOR_REDIS_RETRY_ATTEMPTS,
    INGESTOR_REDIS_RETRY_BACKOFF_MS,
    INGESTOR_STREAM_MAXLEN,
    REDIS_URL,
    get_stripe_settings,
)
from app.db.session import SessionLocal
from app.market_ingestion.runner import MarketIngestionRunner
from app.models.batch_job import BatchJobModel
from app.models.billing_event import BillingEventModel
from app.models.kbar_1m import Kbar1mModel
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
from app.services.rate_limiter import SimpleRateLimiter
from app.services.shioaji_session import build_shioaji_client
from app.services.stripe_provider import StripeProvider
from app.stream_processing.runner import StreamProcessingRunner

logger = logging.getLogger(__name__)

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
serving_rate_limiter = SimpleRateLimiter()
ingestor_runner: MarketIngestionRunner | None = None
aggregator_runner: StreamProcessingRunner | None = None
serving_redis_client = None


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

    aggregator_runner = StreamProcessingRunner(
        redis_client=redis.from_url(REDIS_URL),
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
    )
    logger.info("aggregator runner created")
    return aggregator_runner


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


def reset_state_for_tests() -> None:
    metrics.counters = dict.fromkeys(metrics.counters, 0)
    audit_log.events.clear()
    with SessionLocal() as session:
        session.execute(delete(BatchJobModel))
        session.execute(delete(BillingEventModel))
        session.execute(delete(Kbar1mModel))
        session.execute(delete(SubscriptionModel))
        session.execute(delete(RefreshTokenDenylistModel))
        session.execute(delete(UserModel))
        session.commit()
