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
}

ADMIN_ROUTES = {
    ("GET", "/admin/logs"),
    ("GET", "/admin/logs/{id}"),
}


def path_template(method: str, path: str) -> tuple[str, str]:
    # Keep one explicit template for the admin log detail route.
    if method == "GET" and path.startswith("/admin/logs/"):
        return method, "/admin/logs/{id}"
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
