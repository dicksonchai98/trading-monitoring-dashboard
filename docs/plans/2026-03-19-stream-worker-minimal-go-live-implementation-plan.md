# Stream Worker Minimal Go-Live Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run stream processing in a dedicated worker process so API service no longer executes aggregator loops.

**Architecture:** Keep `StreamProcessingRunner` domain logic unchanged. Add a thin worker runtime + entrypoint, disable aggregator startup from API process, and split docker-compose into API and stream-worker services. Validate with focused unit/integration tests and compose smoke checks.

**Tech Stack:** FastAPI, asyncio, Redis Streams consumer groups, PostgreSQL, docker-compose, pytest

---

### Task 1: Add runtime tests first (TDD)

**Files:**
- Create: `apps/backend/tests/test_stream_processing_worker_runtime.py`
- Reference: `apps/backend/app/stream_processing/runner.py`

**Step 1: Write the failing test**

```python
from __future__ import annotations

import asyncio
from types import SimpleNamespace

from app.stream_processing.worker_runtime import StreamProcessingWorkerRuntime


class _FakeRunner:
    def __init__(self) -> None:
        self.started = False
        self.stopped = False

    async def start(self) -> None:
        self.started = True

    async def stop_async(self) -> None:
        self.stopped = True


async def _builder() -> _FakeRunner:
    return _FakeRunner()


def test_runtime_start_stop_updates_health_state() -> None:
    runtime = StreamProcessingWorkerRuntime(runner_factory=lambda: _FakeRunner())
    asyncio.run(runtime.start())
    assert runtime.health()["up"] == 1
    assert runtime.health()["fatal_error"] is False
    asyncio.run(runtime.stop())
    assert runtime.health()["up"] == 0
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_stream_processing_worker_runtime.py -v`  
Expected: FAIL with `ModuleNotFoundError: app.stream_processing.worker_runtime`

**Step 3: Write minimal implementation**

```python
class StreamProcessingWorkerRuntime:
    def __init__(self, runner_factory):
        self._runner_factory = runner_factory
        self._runner = None
        self._up = 0
        self._fatal_error = False
        self._last_tick_ts = 0.0
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_stream_processing_worker_runtime.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/tests/test_stream_processing_worker_runtime.py apps/backend/app/stream_processing/worker_runtime.py
git commit -m "test(stream-worker): add runtime lifecycle health tests"
```

### Task 2: Implement worker runtime supervision and shutdown

**Files:**
- Create: `apps/backend/app/stream_processing/worker_runtime.py`
- Test: `apps/backend/tests/test_stream_processing_worker_runtime.py`

**Step 1: Write the failing test**

```python
def test_runtime_marks_fatal_error_on_runner_start_exception() -> None:
    class _BoomRunner:
        async def start(self) -> None:
            raise RuntimeError("boom")
        async def stop_async(self) -> None:
            return None

    runtime = StreamProcessingWorkerRuntime(runner_factory=lambda: _BoomRunner())
    try:
        asyncio.run(runtime.start())
    except RuntimeError:
        pass
    state = runtime.health()
    assert state["fatal_error"] is True
    assert state["up"] == 0
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_stream_processing_worker_runtime.py::test_runtime_marks_fatal_error_on_runner_start_exception -v`  
Expected: FAIL because fatal flag handling is missing.

**Step 3: Write minimal implementation**

```python
async def start(self) -> None:
    try:
        self._runner = self._runner_factory()
        await self._runner.start()
        self._up = 1
    except Exception:
        self._fatal_error = True
        self._up = 0
        raise
```

Include:
- `run_forever()` heartbeat loop updating `last_tick_ts`
- `stop(timeout_seconds=10.0)` using `asyncio.wait_for(self._runner.stop_async(), timeout=...)`

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_stream_processing_worker_runtime.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/stream_processing/worker_runtime.py apps/backend/tests/test_stream_processing_worker_runtime.py
git commit -m "feat(stream-worker): add runtime supervision and graceful shutdown"
```

### Task 3: Add standalone stream worker entrypoint

**Files:**
- Create: `apps/backend/workers/stream_processing_worker.py`
- Create: `apps/backend/tests/test_stream_processing_worker_entrypoint.py`
- Modify: `apps/backend/workers/__init__.py`

**Step 1: Write the failing test**

```python
from workers.stream_processing_worker import build_stream_processing_worker_runtime


def test_stream_worker_build_runtime_returns_runtime_instance() -> None:
    runtime = build_stream_processing_worker_runtime()
    assert runtime is not None
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_stream_processing_worker_entrypoint.py -v`  
Expected: FAIL with module/function not found.

**Step 3: Write minimal implementation**

```python
def build_stream_processing_worker_runtime() -> StreamProcessingWorkerRuntime:
    return StreamProcessingWorkerRuntime(runner_factory=state.build_aggregator_runner)


def main() -> None:
    parser = argparse.ArgumentParser(description="run stream processing worker")
    _ = parser.parse_args()
    asyncio.run(run())
```

Include signal handling:
- `signal.SIGTERM`, `signal.SIGINT` set runtime stop flow.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_stream_processing_worker_entrypoint.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/workers/stream_processing_worker.py apps/backend/workers/__init__.py apps/backend/tests/test_stream_processing_worker_entrypoint.py
git commit -m "feat(stream-worker): add standalone worker entrypoint"
```

### Task 4: Remove API-owned aggregator startup

**Files:**
- Modify: `apps/backend/app/main.py`
- Create: `apps/backend/tests/test_main_startup_no_aggregator.py`

**Step 1: Write the failing test**

```python
from app import main


def test_startup_does_not_boot_aggregator(monkeypatch) -> None:
    called = {"aggregator": 0}

    def _boom():
        called["aggregator"] += 1
        raise AssertionError("aggregator must not start in API process")

    monkeypatch.setattr(main.state, "build_aggregator_runner", _boom)
```

Complete test by invoking startup event and asserting no aggregator call.

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_main_startup_no_aggregator.py -v`  
Expected: FAIL because startup still branches into aggregator path.

**Step 3: Write minimal implementation**

In `apps/backend/app/main.py`:
- remove aggregator startup block from `validate_billing_configuration`
- remove aggregator shutdown block from `shutdown_ingestor`
- keep ingestor behavior unchanged

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_main_startup_no_aggregator.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/main.py apps/backend/tests/test_main_startup_no_aggregator.py
git commit -m "refactor(api): stop starting aggregator in API lifecycle"
```

### Task 5: Split docker-compose services and document operation

**Files:**
- Modify: `docker-compose.yml`
- Modify: `apps/backend/README.md`
- Test: `apps/backend/tests/test_stream_processing_integration.py`
- Test: `apps/backend/tests/test_stream_processing_nonfunctional.py`

**Step 1: Write the failing test**

Add compose contract check test (yaml parse) to assert:
- service `backend-api` exists and does not run stream worker command
- service `backend-stream-worker` exists and runs `python -m workers.stream_processing_worker`

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_compose_stream_worker_contract.py -v`  
Expected: FAIL because current compose has only `backend`.

**Step 3: Write minimal implementation**

Update `docker-compose.yml`:
- rename or split existing `backend` into `backend-api`
- add `backend-stream-worker` service with dedicated command
- set `AGGREGATOR_ENABLED: "false"` on API service

Update README runbook:
- start commands
- health expectations
- restart worker command and expected behavior

**Step 4: Run tests to verify passes**

Run:
- `cd apps/backend; pytest tests/test_compose_stream_worker_contract.py -v`
- `cd apps/backend; pytest tests/test_stream_processing_integration.py -v`
- `cd apps/backend; pytest tests/test_stream_processing_nonfunctional.py -v`

Expected: PASS

**Step 5: Commit**

```bash
git add docker-compose.yml apps/backend/README.md apps/backend/tests/test_compose_stream_worker_contract.py
git commit -m "chore(deploy): split api and stream worker services in compose"
```

### Task 6: Final verification and release check

**Files:**
- Verify only changed files from tasks 1-5.

**Step 1: Run full backend targeted checks**

Run:
- `cd apps/backend; pytest tests/test_stream_processing_worker_runtime.py tests/test_stream_processing_worker_entrypoint.py tests/test_main_startup_no_aggregator.py tests/test_stream_processing_integration.py tests/test_stream_processing_nonfunctional.py -v`

Expected: PASS

**Step 2: Run formatting/lint checks**

Run:
- `cd apps/backend; ruff check app workers tests`
- `cd apps/backend; ruff format --check app workers tests`

Expected: PASS

**Step 3: Smoke in docker-compose**

Run:
- `docker compose up -d redis backend-api backend-stream-worker`
- `docker compose ps`

Expected:
- API container healthy and serving HTTP.
- Stream worker container running independently.

**Step 4: Validate separation behavior**

Run:
- stop worker only: `docker compose stop backend-stream-worker`
- verify API still responds
- restart worker: `docker compose start backend-stream-worker`

Expected:
- API uninterrupted.
- worker resumes stream processing.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(stream-worker): ship minimal standalone runtime and compose split"
```

## Notes

- Keep YAGNI: no control-plane endpoints in this phase.
- Keep DRY: reuse `state.build_aggregator_runner` for runner construction.
- Follow TDD strictly for each task.
- Use @test-driven-development and @verification-before-completion during execution.
