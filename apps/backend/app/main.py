"""FastAPI app entrypoint."""

from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI

from app import state
from app.config import AGGREGATOR_ENABLED, INGESTOR_ENABLED, validate_stripe_settings
from app.routes import admin, analytics, auth, billing, realtime
from app.state import metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Trading Dashboard Backend")

app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(realtime.router)
app.include_router(analytics.router)
app.include_router(admin.router)


@app.on_event("startup")
async def validate_billing_configuration() -> None:
    validate_stripe_settings()
    logging.info(f"INGESTOR_ENABLED: {INGESTOR_ENABLED}")
    if INGESTOR_ENABLED:
        runner = state.build_ingestor_runner()
        task = asyncio.create_task(runner.start())
        task.add_done_callback(_log_ingestor_start_failure)
    logging.info(f"AGGREGATOR_ENABLED: {AGGREGATOR_ENABLED}")
    if AGGREGATOR_ENABLED:
        runner = state.build_aggregator_runner()
        task = asyncio.create_task(runner.start())
        task.add_done_callback(_log_aggregator_start_failure)


@app.on_event("shutdown")
async def shutdown_ingestor() -> None:
    if state.ingestor_runner is not None:
        await state.ingestor_runner.stop()
    if state.aggregator_runner is not None:
        await state.aggregator_runner.stop_async()


@app.get("/metrics")
def metrics_route() -> dict[str, dict[str, int]]:
    return {"counters": metrics.counters}


def _log_ingestor_start_failure(task: asyncio.Task[None]) -> None:
    try:
        task.result()
    except Exception:
        logger.exception("ingestor startup failed")


def _log_aggregator_start_failure(task: asyncio.Task[None]) -> None:
    try:
        task.result()
    except Exception:
        logger.exception("aggregator startup failed")
