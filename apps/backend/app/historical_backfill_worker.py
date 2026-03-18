"""Entrypoint for dedicated historical backfill worker process."""

from __future__ import annotations

from app.db.session import SessionLocal
from app.modules.historical_backfill.worker import HistoricalBackfillWorkerRuntime


def main() -> None:
    runtime = HistoricalBackfillWorkerRuntime(session_factory=SessionLocal)
    runtime.run_forever()


if __name__ == "__main__":
    main()
