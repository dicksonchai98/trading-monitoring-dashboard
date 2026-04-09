from __future__ import annotations

from app.db.session import SessionLocal
from app.repositories.audit_event_repository import AuditEventRepository
from app.services.audit import AuditLog
from app.services.metrics import Metrics
from app.state import audit_event_repository


class _BrokenAuditEventRepository(AuditEventRepository):
    def insert(self, **kwargs):  # type: ignore[override]
        raise RuntimeError("db down")


def test_record_writes_memory_and_db() -> None:
    repo = audit_event_repository
    repo.delete_all()
    metrics = Metrics()
    service = AuditLog(repository=repo, metrics=metrics)

    service.record(
        event_type="crawler_run_triggered",
        path="/api/admin/batch/crawler/jobs",
        actor="admin",
        role="admin",
        metadata={"job_id": 1},
    )

    assert len(service.events) == 1
    items, total = repo.query(
        from_ts=None,
        to_ts=None,
        event_type="crawler_run_triggered",
        actor=None,
        path=None,
        result=None,
        limit=10,
        offset=0,
    )
    assert total == 1
    assert items[0].result == "accepted"
    assert int(metrics.counters["audit_write_success_total"]) == 1


def test_record_fail_open_on_db_error() -> None:
    metrics = Metrics()
    service = AuditLog(repository=_BrokenAuditEventRepository(SessionLocal), metrics=metrics)

    service.record(
        event_type="admin_access_denied",
        path="/api/admin/logs",
        actor="member",
        role="member",
    )

    assert len(service.events) == 1
    assert int(metrics.counters["audit_write_failure_total"]) == 1
