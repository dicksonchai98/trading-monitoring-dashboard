from __future__ import annotations

import asyncio
from contextlib import suppress

import pytest
from app.stream_processing import worker_runtime as worker_runtime_module
from app.stream_processing.worker_runtime import StreamProcessingWorkerRuntime


class _FakeRunner:
    def __init__(self) -> None:
        self.started = False
        self.stopped = False
        self.stop_calls = 0

    async def start(self) -> None:
        self.started = True

    async def stop_async(self) -> None:
        self.stopped = True
        self.stop_calls += 1


class _FlakyStopRunner(_FakeRunner):
    def __init__(self) -> None:
        super().__init__()
        self._failed_once = False

    async def stop_async(self) -> None:
        self.stop_calls += 1
        if not self._failed_once:
            self._failed_once = True
            raise RuntimeError("stop failed")
        self.stopped = True


class _BlockingStopRunner(_FakeRunner):
    def __init__(self) -> None:
        super().__init__()
        self.stop_entered = asyncio.Event()
        self._release_stop = asyncio.Event()

    async def stop_async(self) -> None:
        self.stop_calls += 1
        self.stop_entered.set()
        await self._release_stop.wait()
        self.stopped = True

    def release_stop(self) -> None:
        self._release_stop.set()


class _BoomRunner:
    async def start(self) -> None:
        raise RuntimeError("boom")

    async def stop_async(self) -> None:
        return None


class _FlakyStartFactory:
    def __init__(self) -> None:
        self.calls = 0

    def __call__(self) -> _FakeRunner | _BoomRunner:
        self.calls += 1
        if self.calls == 1:
            return _BoomRunner()
        return _FakeRunner()


class _FailingBackgroundTaskRunner(_FakeRunner):
    def __init__(self) -> None:
        super().__init__()
        self._tick_task = None

    async def start(self) -> None:
        await super().start()
        self._tick_task = asyncio.get_running_loop().create_future()
        self._tick_task.set_exception(RuntimeError("tick task failed"))


def test_runtime_start_stop_updates_health_state() -> None:
    fake_runner = _FakeRunner()
    runtime = StreamProcessingWorkerRuntime(runner_factory=lambda: fake_runner)

    asyncio.run(runtime.start())
    health = runtime.health()
    assert fake_runner.started is True
    assert health["up"] == 1
    assert health["fatal_error"] is False
    assert health["last_tick_ts"] > 0

    asyncio.run(runtime.stop())
    asyncio.run(runtime.stop())
    assert fake_runner.stopped is True
    assert fake_runner.stop_calls == 1
    assert runtime.health()["up"] == 0


def test_runtime_stop_failure_is_retry_safe() -> None:
    fake_runner = _FlakyStopRunner()
    runtime = StreamProcessingWorkerRuntime(runner_factory=lambda: fake_runner)

    asyncio.run(runtime.start())

    with suppress(RuntimeError):
        asyncio.run(runtime.stop())

    assert fake_runner.stopped is False
    assert fake_runner.stop_calls == 1
    assert runtime.health()["up"] == 1

    asyncio.run(runtime.stop())
    assert fake_runner.stopped is True
    assert fake_runner.stop_calls == 2
    assert runtime.health()["up"] == 0


def test_runtime_stop_cleans_up_when_state_is_stopped_but_runner_exists() -> None:
    fake_runner = _FakeRunner()
    runtime = StreamProcessingWorkerRuntime(runner_factory=lambda: fake_runner)

    asyncio.run(runtime.start())
    runtime._state = "stopped"

    asyncio.run(runtime.stop())

    assert fake_runner.stopped is True
    assert fake_runner.stop_calls == 1
    assert runtime.health()["up"] == 0


def test_runtime_start_failure_sets_fatal_error() -> None:
    runtime = StreamProcessingWorkerRuntime(runner_factory=lambda: _BoomRunner())

    with suppress(RuntimeError):
        asyncio.run(runtime.start())

    health = runtime.health()
    assert health["fatal_error"] is True
    assert health["up"] == 0


def test_runtime_start_retry_clears_fatal_error() -> None:
    factory = _FlakyStartFactory()
    runtime = StreamProcessingWorkerRuntime(runner_factory=factory)

    with suppress(RuntimeError):
        asyncio.run(runtime.start())

    assert runtime.health()["fatal_error"] is True

    asyncio.run(runtime.start())
    health = runtime.health()
    assert health["fatal_error"] is False
    assert health["up"] == 1


def test_runtime_run_forever_updates_heartbeat_ts(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_runner = _FakeRunner()
    runtime = StreamProcessingWorkerRuntime(runner_factory=lambda: fake_runner)
    original_sleep = asyncio.sleep

    async def _fast_sleep(_delay: float) -> None:
        await original_sleep(0)

    async def _exercise() -> None:
        task = asyncio.create_task(runtime.run_forever())
        try:
            await original_sleep(0)
            initial_ts = runtime.health()["last_tick_ts"]
            for _ in range(20):
                await original_sleep(0.01)
                if runtime.health()["last_tick_ts"] > initial_ts:
                    break
            assert runtime.health()["last_tick_ts"] > initial_ts
            await runtime.stop()
            await task
        finally:
            if not task.done():
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task

    monkeypatch.setattr(worker_runtime_module.asyncio, "sleep", _fast_sleep)
    asyncio.run(_exercise())


def test_runtime_stop_cancellation_keeps_state_retryable() -> None:
    fake_runner = _BlockingStopRunner()
    runtime = StreamProcessingWorkerRuntime(runner_factory=lambda: fake_runner)

    async def _exercise() -> None:
        await runtime.start()
        task = asyncio.create_task(runtime.stop())
        try:
            await asyncio.wait_for(fake_runner.stop_entered.wait(), timeout=1.0)
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            assert runtime.health()["up"] == 1
            assert fake_runner.stop_calls == 1
            fake_runner.release_stop()
            await runtime.stop()
            assert fake_runner.stopped is True
            assert fake_runner.stop_calls == 2
            assert runtime.health()["up"] == 0
        finally:
            if not task.done():
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task

    asyncio.run(_exercise())


def test_runtime_run_forever_marks_fatal_on_background_task_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_runner = _FailingBackgroundTaskRunner()
    runtime = StreamProcessingWorkerRuntime(runner_factory=lambda: fake_runner)
    original_sleep = asyncio.sleep

    async def _fast_sleep(_delay: float) -> None:
        await original_sleep(0)

    monkeypatch.setattr(worker_runtime_module.asyncio, "sleep", _fast_sleep)

    asyncio.run(runtime.run_forever())

    health = runtime.health()
    assert health["fatal_error"] is True
    assert health["up"] == 0
    assert fake_runner.stopped is True
    assert fake_runner.stop_calls == 1
