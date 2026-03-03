"""FastAPI app entrypoint."""

from __future__ import annotations

from fastapi import FastAPI
import logging

from app.config import validate_stripe_settings
from app.routes import admin, analytics, auth, billing, realtime
from app.state import metrics

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Trading Dashboard Backend")

app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(realtime.router)
app.include_router(analytics.router)
app.include_router(admin.router)


@app.on_event("startup")
def validate_billing_configuration() -> None:
    validate_stripe_settings()


@app.get("/metrics")
def metrics_route() -> dict[str, dict[str, int]]:
    return {"counters": metrics.counters}

