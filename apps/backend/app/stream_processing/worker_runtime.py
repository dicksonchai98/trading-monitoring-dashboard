from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any


class StreamProcessingWorkerRuntime:
    _heartbeat_interval_seconds = 1.0

    def __init__(self, runner_factory: Callable[[], Any]) -> None:
        self._runner_factory = runner_factory
        self._runner: Any | None = None
        self._lifecycle_lock = asyncio.Lock()
        self._state = "stopped"
        self._up = 0
        self._fatal_error = False
        self._last_tick_ts = 0.0

    async def start(self) -> None:
        async with self._lifecycle_lock:
            if self._state != "stopped":
                raise RuntimeError(f"runtime is already {self._state}")
            self._state = "starting"
            runner: Any | None = None
            try:
                runner = self._runner_factory()
                self._runner = runner
                await runner.start()
            except asyncio.CancelledError:
                await self._cleanup_start_failure(runner)
                raise
            except Exception:
                self._fatal_error = True
                await self._cleanup_start_failure(runner)
                raise
            self._fatal_error = False
            self._up = 1
            self._last_tick_ts = asyncio.get_running_loop().time()
            self._state = "running"

    async def stop(self) -> None:
        async with self._lifecycle_lock:
            runner = self._runner
            if runner is None:
                self._up = 0
                return
            self._state = "stopping"
            self._up = 0
            try:
                stopped = await self._stop_runner(runner)
            except asyncio.CancelledError:
                self._state = "running"
                self._up = 1
                raise
            except Exception:
                self._state = "running"
                self._up = 1
                raise
            if not stopped:
                self._runner = None
                self._state = "stopped"
                return
            self._runner = None
            self._state = "stopped"

    async def run_forever(self) -> None:
        await self.start()
        try:
            while True:
                async with self._lifecycle_lock:
                    runner = self._runner
                    if self._state != "running" or runner is None:
                        return
                    if self._runner_background_tasks_failed(runner):
                        self._fatal_error = True
                        self._up = 0
                        self._state = "stopped"
                        try:
                            stopped = await self._stop_runner(runner)
                        except asyncio.CancelledError:
                            raise
                        except Exception:
                            self._state = "running"
                            return
                        if stopped:
                            self._runner = None
                        else:
                            self._state = "running"
                        return
                    self._last_tick_ts = asyncio.get_running_loop().time()
                await asyncio.sleep(self._heartbeat_interval_seconds)
        except asyncio.CancelledError:
            await self.stop()
            raise

    def health(self) -> dict[str, Any]:
        return {
            "up": self._up,
            "fatal_error": self._fatal_error,
            "last_tick_ts": self._last_tick_ts,
        }

    async def _cleanup_start_failure(self, runner: Any | None) -> None:
        self._up = 0
        self._state = "stopped"
        self._runner = None
        if runner is None:
            return
        stop_async = getattr(runner, "stop_async", None)
        if stop_async is None:
            return
        try:
            await asyncio.wait_for(stop_async(), timeout=10.0)
        except asyncio.CancelledError:
            return
        except Exception:
            return

    async def _stop_runner(self, runner: Any) -> bool:
        stop_async = getattr(runner, "stop_async", None)
        if stop_async is None:
            return False
        await asyncio.wait_for(stop_async(), timeout=10.0)
        return True

    @staticmethod
    def _runner_background_tasks_failed(runner: Any) -> bool:
        for attr_name in (
            "_task",
            "_db_sink_task",
            "_tick_task",
            "_bidask_task",
            "_tick_db_sink_task",
            "_bidask_db_sink_task",
        ):
            task = getattr(runner, attr_name, None)
            if task is None:
                continue
            done = getattr(task, "done", None)
            if not callable(done) or not done():
                continue
            cancelled = getattr(task, "cancelled", None)
            if callable(cancelled) and cancelled():
                return True
            exception = getattr(task, "exception", None)
            if not callable(exception):
                continue
            try:
                if exception() is not None:
                    return True
            except asyncio.CancelledError:
                return True
            except Exception:
                return True
        return False
