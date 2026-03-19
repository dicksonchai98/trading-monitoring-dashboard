"""FastAPI app entrypoint."""

from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import state
from app.config import (
    INGESTOR_ENABLED,
    SERVING_CORS_ALLOW_ORIGINS,
    validate_stripe_settings,
)
from app.routes import (
    admin,
    analytics,
    auth,
    batch_jobs,
    billing,
    historical_backfill,
    market_crawler,
    realtime,
)
from app.state import metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Trading Dashboard Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=SERVING_CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(realtime.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(historical_backfill.router)
app.include_router(market_crawler.router)
app.include_router(batch_jobs.router)


@app.on_event("startup")
async def validate_billing_configuration() -> None:
    validate_stripe_settings()
    logging.info(f"INGESTOR_ENABLED: {INGESTOR_ENABLED}")
    if INGESTOR_ENABLED:
        runner = state.build_ingestor_runner()
        task = asyncio.create_task(runner.start())
        task.add_done_callback(_log_ingestor_start_failure)


@app.on_event("shutdown")
async def shutdown_ingestor() -> None:
    if state.ingestor_runner is not None:
        await state.ingestor_runner.stop()


@app.get("/metrics")
def metrics_route() -> dict[str, dict[str, int]]:
    return {"counters": metrics.counters}


def _log_ingestor_start_failure(task: asyncio.Task[None]) -> None:
    try:
        task.result()
    except Exception:
        logger.exception("ingestor startup failed")
