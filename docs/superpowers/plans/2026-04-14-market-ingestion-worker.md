# Market Ingestion Worker Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move market ingestion out of `backend-api` and run it as a dedicated compose worker without changing ingestion data contracts.

**Architecture:** Add a new worker entrypoint that wraps `state.build_ingestor_runner()` with the same signal-handling lifecycle pattern used by existing stream workers. Remove API startup/shutdown ingestion boot paths so API only serves HTTP/SSE endpoints. Add a compose service for the new worker and update docs/tests to enforce the new process boundary.

**Tech Stack:** Python (FastAPI, asyncio, pytest), Docker Compose, Redis Streams, Shioaji ingestion runtime.

---

## File Structure (planned changes)

- **Create** `apps/backend/workers/ingestor_worker.py`
  - Dedicated process entrypoint for `MarketIngestionRunner`.
- **Modify** `apps/backend/app/main.py`
  - Remove ingestion startup/shutdown coupling from API process.
- **Modify** `docker-compose.yml`
  - Add `backend-ingestor-worker` service (default startup).
- **Modify** `apps/backend/tests/test_stream_processing_worker_entrypoint.py`
  - Assert new worker runtime builder returns `StreamProcessingWorkerRuntime`.
- **Modify** `apps/backend/tests/test_compose_stream_worker_contract.py`
  - Enforce compose contract for `backend-ingestor-worker`.
- **Modify** `apps/backend/tests/test_main_startup_no_aggregator.py`
  - Assert API startup does not attempt ingestion bootstrap.
- **Modify** `apps/backend/README.md`
  - Update ops notes: ingestion is a dedicated worker.
- **Modify** `apps/backend/docs/market-ingestor-ops.md`
  - Update runbook startup model and process ownership.

---

### Task 1: Add failing tests for new ingestion worker runtime and API decoupling

**Files:**
- Modify: `apps/backend/tests/test_stream_processing_worker_entrypoint.py`
- Modify: `apps/backend/tests/test_main_startup_no_aggregator.py`
- Test: `apps/backend/tests/test_stream_processing_worker_entrypoint.py`
- Test: `apps/backend/tests/test_main_startup_no_aggregator.py`

- [ ] **Step 1: Write failing worker entrypoint test**

```python
# apps/backend/tests/test_stream_processing_worker_entrypoint.py
from workers.ingestor_worker import build_ingestor_worker_runtime

def test_ingestor_worker_build_runtime_returns_runtime_instance() -> None:
    runtime = build_ingestor_worker_runtime()
    assert isinstance(runtime, StreamProcessingWorkerRuntime)
```

- [ ] **Step 2: Write failing API startup decoupling assertion**

```python
# apps/backend/tests/test_main_startup_no_aggregator.py
def test_startup_does_not_boot_ingestor(monkeypatch) -> None:
    monkeypatch.setattr(main, "validate_stripe_settings", lambda: None)
    called = {"ingestor": 0}

    def _forbidden_ingestor_call():
        called["ingestor"] += 1
        raise AssertionError("ingestor must not start in API process")

    monkeypatch.setattr(main.state, "build_ingestor_runner", _forbidden_ingestor_call)
    asyncio.run(main.validate_billing_configuration())
    assert called["ingestor"] == 0
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pytest apps/backend/tests/test_stream_processing_worker_entrypoint.py::test_ingestor_worker_build_runtime_returns_runtime_instance -v
pytest apps/backend/tests/test_main_startup_no_aggregator.py::test_startup_does_not_boot_ingestor -v
```

Expected:
- First test FAIL with import/module error for `workers.ingestor_worker`.
- Second test may PASS or FAIL depending on current API startup behavior; keep it as guardrail before code changes.

- [ ] **Step 4: Commit test scaffolding**

```bash
git add apps/backend/tests/test_stream_processing_worker_entrypoint.py apps/backend/tests/test_main_startup_no_aggregator.py
git commit -m "test: add guards for ingestion worker isolation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Implement dedicated ingestion worker entrypoint

**Files:**
- Create: `apps/backend/workers/ingestor_worker.py`
- Modify: `apps/backend/tests/test_stream_processing_worker_entrypoint.py`
- Test: `apps/backend/tests/test_stream_processing_worker_entrypoint.py`

- [ ] **Step 1: Implement ingestion worker runtime builder and main loop**

```python
# apps/backend/workers/ingestor_worker.py
"""Market ingestion worker process entrypoint."""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal

from app import state
from app.stream_processing.worker_runtime import StreamProcessingWorkerRuntime

logger = logging.getLogger(__name__)


def build_ingestor_worker_runtime() -> StreamProcessingWorkerRuntime:
    return StreamProcessingWorkerRuntime(runner_factory=state.build_ingestor_runner)


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

    logger.info("ingestor worker stop signal received")
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        await runtime.stop()


def main() -> None:
    parser = argparse.ArgumentParser(description="run market-ingestion worker")
    _ = parser.parse_args()
    runtime = build_ingestor_worker_runtime()
    asyncio.run(_run_worker(runtime))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Ensure test file imports the new builder**

```python
# apps/backend/tests/test_stream_processing_worker_entrypoint.py
from workers.ingestor_worker import build_ingestor_worker_runtime
```

- [ ] **Step 3: Run targeted runtime tests**

Run:

```bash
pytest apps/backend/tests/test_stream_processing_worker_entrypoint.py -v
```

Expected:
- PASS, including `test_ingestor_worker_build_runtime_returns_runtime_instance`.

- [ ] **Step 4: Commit worker entrypoint**

```bash
git add apps/backend/workers/ingestor_worker.py apps/backend/tests/test_stream_processing_worker_entrypoint.py
git commit -m "feat: add dedicated market ingestion worker entrypoint" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Remove ingestion bootstrap from API startup/shutdown

**Files:**
- Modify: `apps/backend/app/main.py`
- Modify: `apps/backend/tests/test_main_startup_no_aggregator.py`
- Test: `apps/backend/tests/test_main_startup_no_aggregator.py`

- [ ] **Step 1: Remove INGESTOR_ENABLED startup dependency and shutdown hook usage**

```python
# apps/backend/app/main.py (imports)
from app.config import (
    SERVING_CORS_ALLOW_ORIGINS,
    validate_stripe_settings,
)

# apps/backend/app/main.py (startup)
@app.on_event("startup")
async def validate_billing_configuration() -> None:
    validate_stripe_settings()

# apps/backend/app/main.py
# Remove shutdown_ingestor event handler entirely.
```

- [ ] **Step 2: Update startup test to only assert no aggregator/no ingestor boot**

```python
# apps/backend/tests/test_main_startup_no_aggregator.py
def test_startup_does_not_boot_aggregator(monkeypatch) -> None:
    monkeypatch.setattr(main, "validate_stripe_settings", lambda: None)
    called = {"aggregator": 0}

    def _forbidden_call():
        called["aggregator"] += 1
        raise AssertionError("aggregator must not start in API process")

    monkeypatch.setattr(main.state, "build_aggregator_runner", _forbidden_call)
    asyncio.run(main.validate_billing_configuration())
    assert called["aggregator"] == 0


def test_startup_does_not_boot_ingestor(monkeypatch) -> None:
    monkeypatch.setattr(main, "validate_stripe_settings", lambda: None)
    called = {"ingestor": 0}

    def _forbidden_call():
        called["ingestor"] += 1
        raise AssertionError("ingestor must not start in API process")

    monkeypatch.setattr(main.state, "build_ingestor_runner", _forbidden_call)
    asyncio.run(main.validate_billing_configuration())
    assert called["ingestor"] == 0
```

- [ ] **Step 3: Run startup behavior tests**

Run:

```bash
pytest apps/backend/tests/test_main_startup_no_aggregator.py -v
```

Expected:
- PASS; startup path no longer references ingestion bootstrap.

- [ ] **Step 4: Commit API decoupling**

```bash
git add apps/backend/app/main.py apps/backend/tests/test_main_startup_no_aggregator.py
git commit -m "refactor: remove ingestion bootstrap from api process" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Add compose service contract for ingestion worker

**Files:**
- Modify: `docker-compose.yml`
- Modify: `apps/backend/tests/test_compose_stream_worker_contract.py`
- Test: `apps/backend/tests/test_compose_stream_worker_contract.py`

- [ ] **Step 1: Add `backend-ingestor-worker` service in compose**

```yaml
# docker-compose.yml
  backend-ingestor-worker:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    command: python -m workers.ingestor_worker
    env_file:
      - ./.env
    depends_on:
      - redis
    environment:
      DATABASE_URL: ${DATABASE_URL_DOCKER:-postgresql+psycopg://postgres:981025060598Cc!@host.docker.internal:5432/trading_dashboard}
      REDIS_URL: ${REDIS_URL_DOCKER:-redis://redis:6379/0}
```

- [ ] **Step 2: Extend compose contract test**

```python
# apps/backend/tests/test_compose_stream_worker_contract.py
assert "backend-ingestor-worker:" in content
assert "command: python -m workers.ingestor_worker" in content
```

- [ ] **Step 3: Run compose contract test**

Run:

```bash
pytest apps/backend/tests/test_compose_stream_worker_contract.py -v
```

Expected:
- PASS and ensures future changes keep the worker in compose.

- [ ] **Step 4: Commit compose wiring**

```bash
git add docker-compose.yml apps/backend/tests/test_compose_stream_worker_contract.py
git commit -m "chore: wire dedicated ingestion worker into compose" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Update runbook/docs for new process ownership

**Files:**
- Modify: `apps/backend/README.md`
- Modify: `apps/backend/docs/market-ingestor-ops.md`

- [ ] **Step 1: Update backend README ingestion section**

```markdown
## Market Ingestor (Shioaji -> Redis Streams)

- Dedicated process entrypoint: `python -m workers.ingestor_worker`
- In docker-compose, ingestion runs in `backend-ingestor-worker` (not `backend-api`)
- Required credentials: `SHIOAJI_API_KEY`, `SHIOAJI_SECRET_KEY`
- Stream naming: `{env}:stream:{quote_type}:{code}`
```

- [ ] **Step 2: Update market-ingestor runbook startup model**

```markdown
## Runtime ownership

- `backend-api`: HTTP API only; does not bootstrap ingestion.
- `backend-ingestor-worker`: owns Shioaji login/subscription/reconnect and Redis stream writes.

## Start commands

- Local worker run: `python -m workers.ingestor_worker`
- Compose run: `docker compose up -d redis backend-api backend-ingestor-worker`
```

- [ ] **Step 3: Verify markdown references are consistent**

Run:

```bash
pytest apps/backend/tests/test_market_ingestion_startup.py -v
```

Expected:
- PASS (metrics contract remains stable despite process move).

- [ ] **Step 4: Commit docs**

```bash
git add apps/backend/README.md apps/backend/docs/market-ingestor-ops.md
git commit -m "docs: describe dedicated ingestion worker runtime" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: End-to-end verification for migration safety

**Files:**
- Test only (no new files): existing backend test files and compose services

- [ ] **Step 1: Run focused backend test batch**

Run:

```bash
pytest \
  apps/backend/tests/test_stream_processing_worker_entrypoint.py \
  apps/backend/tests/test_main_startup_no_aggregator.py \
  apps/backend/tests/test_compose_stream_worker_contract.py \
  apps/backend/tests/test_market_ingestion_startup.py -v
```

Expected:
- PASS for all migration-related test contracts.

- [ ] **Step 2: Manual compose smoke test for process isolation**

Run:

```bash
docker compose up -d redis backend-api backend-ingestor-worker
docker compose ps
docker compose logs --tail=100 backend-ingestor-worker
docker compose logs --tail=100 backend-api
```

Expected:
- `backend-ingestor-worker` running with ingestion lifecycle logs.
- `backend-api` running without ingestion startup logs.

- [ ] **Step 3: Validate stream write path remains alive**

Run:

```bash
docker compose exec redis redis-cli KEYS "dev:stream:*"
```

Expected:
- Non-empty stream keys (or expected environment-prefixed keys) with ongoing updates.

- [ ] **Step 4: Final commit for any follow-up fixes**

```bash
git add -A
git commit -m "test: finalize ingestion worker isolation validation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

