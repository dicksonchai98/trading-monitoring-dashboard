"""Cron worker entrypoint for scheduled k-bar analytics pipeline."""

from __future__ import annotations

import argparse
import logging
import time

from app.config import (
    KBAR_ANALYTICS_CRON_CODE,
    KBAR_ANALYTICS_CRON_ENABLED,
    KBAR_ANALYTICS_CRON_INTERVAL_SECONDS,
    KBAR_ANALYTICS_CRON_WINDOW_DAYS,
)
from app.db.session import SessionLocal
from app.modules.kbar_analytics.cron import run_daily_pipeline_once

logger = logging.getLogger(__name__)


def run_once() -> dict[str, dict[str, int] | int]:
    return run_daily_pipeline_once(
        session_factory=SessionLocal,
        code=KBAR_ANALYTICS_CRON_CODE,
        window_days=KBAR_ANALYTICS_CRON_WINDOW_DAYS,
    )


def run_forever() -> None:
    while True:
        try:
            result = run_once()
            logger.info("kbar analytics cron cycle completed: %s", result)
        except Exception:
            logger.exception("kbar analytics cron cycle failed")
        time.sleep(max(1, KBAR_ANALYTICS_CRON_INTERVAL_SECONDS))


def main() -> None:
    parser = argparse.ArgumentParser(description="run kbar analytics cron worker")
    parser.add_argument("--once", action="store_true", help="run one cycle and exit")
    args = parser.parse_args()

    if not KBAR_ANALYTICS_CRON_ENABLED and not args.once:
        logger.info("kbar analytics cron is disabled")
        return

    if args.once:
        run_once()
        return
    run_forever()


if __name__ == "__main__":
    main()
