from __future__ import annotations

from app.stream_processing.worker_runtime import StreamProcessingWorkerRuntime
from workers.stream_processing_worker import build_stream_processing_worker_runtime


def test_stream_worker_build_runtime_returns_runtime_instance() -> None:
    runtime = build_stream_processing_worker_runtime()
    assert isinstance(runtime, StreamProcessingWorkerRuntime)
