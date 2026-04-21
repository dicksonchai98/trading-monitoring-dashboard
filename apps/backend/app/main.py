"""FastAPI app entrypoint."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import state
from app.config import (
    SERVING_CORS_ALLOW_ORIGINS,
    validate_stripe_settings,
)
from app.routes import (
    admin,
    analytics,
    auth,
    batch_jobs,
    billing,
    email_webhooks,
    historical_backfill,
    market_crawler,
    realtime,
    serving,
)

logging.basicConfig(level=logging.INFO)

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
app.include_router(email_webhooks.router)
app.include_router(realtime.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(historical_backfill.router)
app.include_router(market_crawler.router)
app.include_router(batch_jobs.router)
app.include_router(serving.router)


@app.on_event("startup")
async def validate_billing_configuration() -> None:
    validate_stripe_settings()


@app.get("/metrics")
def metrics_route() -> dict[str, dict[str, int]]:
    return {"counters": state.metrics.counters}
