"""Central RBAC matrix and route policy checks."""

from __future__ import annotations

PUBLIC_ROUTES = {
    ("POST", "/auth/register"),
    ("POST", "/auth/login"),
    ("GET", "/billing/plans"),
    ("GET", "/realtime/strength"),
}

PROTECTED_ROUTES = {
    ("POST", "/auth/refresh"),
    ("POST", "/billing/checkout"),
    ("GET", "/billing/status"),
    ("GET", "/realtime/weighted"),
    ("GET", "/analytics/history"),
    ("GET", "/analytics/events"),
    ("GET", "/analytics/metrics"),
    ("GET", "/analytics/events/{event_id}/stats"),
    ("GET", "/analytics/events/{event_id}/samples"),
    ("GET", "/analytics/distributions/{metric_id}"),
    ("POST", "/analytics/jobs/rebuild-daily-features"),
    ("POST", "/analytics/jobs/recompute-event-stats"),
    ("POST", "/analytics/jobs/recompute-distribution-stats"),
}

ADMIN_ROUTES = {
    ("GET", "/api/admin/logs"),
    ("GET", "/api/admin/logs/{id}"),
    ("POST", "/api/admin/batch/backfill/jobs"),
    ("GET", "/api/admin/batch/backfill/jobs"),
    ("GET", "/api/admin/batch/backfill/jobs/{job_id}"),
    ("POST", "/api/admin/batch/crawler/jobs"),
    ("GET", "/api/admin/batch/jobs"),
    ("GET", "/api/admin/batch/jobs/{job_id}"),
}


def path_template(method: str, path: str) -> tuple[str, str]:
    # Keep one explicit template for the admin log detail route.
    if method == "GET" and path.startswith("/api/admin/logs/"):
        return method, "/api/admin/logs/{id}"
    if method == "GET" and path.startswith("/api/admin/batch/backfill/jobs/"):
        return method, "/api/admin/batch/backfill/jobs/{job_id}"
    if method == "GET" and path.startswith("/api/admin/batch/jobs/"):
        return method, "/api/admin/batch/jobs/{job_id}"
    if method == "GET" and path.startswith("/analytics/events/") and path.endswith("/stats"):
        return method, "/analytics/events/{event_id}/stats"
    if method == "GET" and path.startswith("/analytics/events/") and path.endswith("/samples"):
        return method, "/analytics/events/{event_id}/samples"
    if method == "GET" and path.startswith("/analytics/distributions/"):
        return method, "/analytics/distributions/{metric_id}"
    return method, path


def classify_route(method: str, path: str) -> str:
    key = path_template(method, path)
    if key in PUBLIC_ROUTES:
        return "public"
    if key in PROTECTED_ROUTES:
        return "protected"
    if key in ADMIN_ROUTES:
        return "admin"
    # Default deny for unknown routes can be handled by explicit dependencies.
    return "unknown"
