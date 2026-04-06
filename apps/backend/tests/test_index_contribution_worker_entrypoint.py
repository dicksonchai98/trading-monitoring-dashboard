from __future__ import annotations

from app.stream_processing.worker_runtime import StreamProcessingWorkerRuntime
from workers.index_contribution_worker import build_index_contribution_worker_runtime


def test_index_contribution_worker_build_runtime_returns_runtime_instance() -> None:
    runtime = build_index_contribution_worker_runtime()
    assert isinstance(runtime, StreamProcessingWorkerRuntime)
