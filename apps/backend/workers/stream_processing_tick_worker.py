"""Tick stream processing worker process entrypoint."""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal

from app import state
from app.stream_processing.worker_runtime import StreamProcessingWorkerRuntime

logger = logging.getLogger(__name__)


def build_tick_stream_processing_worker_runtime() -> StreamProcessingWorkerRuntime:
    return StreamProcessingWorkerRuntime(runner_factory=state.build_tick_aggregator_runner)


async def _run_worker(runtime: StreamProcessingWorkerRuntime) -> None:
    stop_requested = asyncio.Event()
    loop = asyncio.get_running_loop()

    def _request_stop() -> None:
        stop_requested.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _request_stop)
        except NotImplementedError:
            signal.signal(sig, lambda *_args: _request_stop())

    worker_task = asyncio.create_task(runtime.run_forever())
    done, _pending = await asyncio.wait(
        {worker_task, asyncio.create_task(stop_requested.wait())},
        return_when=asyncio.FIRST_COMPLETED,
    )
    if worker_task in done:
        await worker_task
        return
    logger.info("tick stream worker stop signal received")
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        await runtime.stop()


def main() -> None:
    parser = argparse.ArgumentParser(description="run tick stream processing worker")
    _ = parser.parse_args()
    runtime = build_tick_stream_processing_worker_runtime()
    asyncio.run(_run_worker(runtime))


if __name__ == "__main__":
    main()
