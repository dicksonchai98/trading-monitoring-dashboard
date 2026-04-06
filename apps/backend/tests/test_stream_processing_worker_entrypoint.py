from __future__ import annotations

from app.stream_processing.worker_runtime import StreamProcessingWorkerRuntime
from workers.latest_state_worker import build_latest_state_worker_runtime
from workers.quote_worker import build_quote_worker_runtime
from workers.stream_processing_bidask_worker import build_bidask_stream_processing_worker_runtime
from workers.stream_processing_tick_worker import build_tick_stream_processing_worker_runtime
from workers.stream_processing_worker import build_stream_processing_worker_runtime


def test_stream_worker_build_runtime_returns_runtime_instance() -> None:
    runtime = build_stream_processing_worker_runtime()
    assert isinstance(runtime, StreamProcessingWorkerRuntime)


def test_tick_stream_worker_build_runtime_returns_runtime_instance() -> None:
    runtime = build_tick_stream_processing_worker_runtime()
    assert isinstance(runtime, StreamProcessingWorkerRuntime)


def test_bidask_stream_worker_build_runtime_returns_runtime_instance() -> None:
    runtime = build_bidask_stream_processing_worker_runtime()
    assert isinstance(runtime, StreamProcessingWorkerRuntime)


def test_latest_state_worker_build_runtime_returns_runtime_instance() -> None:
    runtime = build_latest_state_worker_runtime()
    assert isinstance(runtime, StreamProcessingWorkerRuntime)


def test_quote_worker_build_runtime_returns_runtime_instance() -> None:
    runtime = build_quote_worker_runtime()
    assert isinstance(runtime, StreamProcessingWorkerRuntime)
