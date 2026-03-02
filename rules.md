# Project Rules (Backend Python)

This document standardizes the existing project style and architecture choices.
It reflects the current codebase conventions rather than introducing new ones.

## 1. Module Structure

- Keep the modular monolith layout under `apps/backend/app`.
- Domain modules live under `app/{routes,services,repositories,models,market_ingestion}`.
- Cross-cutting concerns live in `app/{config,state,deps,rbac}`.
- Avoid cross-domain imports that violate the intended boundaries.

## 2. Imports and Module Header

- Use `from __future__ import annotations` at the top of each module.
- Standard library imports first, third-party next, local imports last.
- Prefer `logging.getLogger(__name__)` for module-level logger setup.

## 3. Typing and Dataclasses

- All public functions and methods must have type hints.
- Use `dict[str, Any]`, `list[str]`, `tuple[str, str]` style annotations.
- Prefer `@dataclass` for small immutable value objects.
- Use `Protocol` where a lightweight interface is needed.

## 4. Error Handling (Unified)

- Use a domain-specific exception class for each domain service (e.g., `BillingError`).
- If using `ValueError` for flow control, the `.args[0]` must be a short snake_case code.
- Do not mix `ValueError` and domain exceptions in the same service layer.
- Avoid bare `except:`; catch explicit exception types and re-raise with domain codes.

## 5. FastAPI Conventions

- Use `APIRouter` with `prefix` and `tags`.
- Request/response bodies are defined with `pydantic.BaseModel`.
- Dependencies are provided via `Depends(...)` in route handlers.
- Keep route handlers thin; business logic lives in services.

## 6. State and Dependency Wiring (Unified)

- `app/state.py` owns singleton services and repositories.
- Keep module-scope wiring for pure-Python services only.
- Runtime dependency creation (network clients, Redis, Shioaji) lives in `build_*` helpers.
- Avoid duplicating configuration fetches within the same module; cache locally when needed.

## 7. Metrics and Logging (Unified)

- All module-level loggers are created at the top with `logger = logging.getLogger(__name__)`.
- Metrics side effects belong at the boundary layer:
  - auth/permission checks in `deps.py`
  - request handling in `routes/*`
  - ingestion loop in `market_ingestion/*`
- Helper utilities should not mutate metrics directly unless they are the boundary.
- Avoid logging secrets or raw credentials.

## 8. Data and Time Handling

- Use UTC-aware timestamps (`datetime.now(tz=timezone.utc)`).
- Serialize timestamps with `.isoformat()`.

## 9. Testing Style

- Prefer small, explicit unit tests with fake API objects.
- Use pytest fixtures in `tests/conftest.py`.
- Keep tests focused on behavior, not implementation details.

## 10. Formatting

- No enforced formatter currently; follow PEP 8 conventions.
- Keep function and class names descriptive and consistent.

## 11. Inconsistency Cleanup Targets

- Standardize error handling per domain (no mixed `ValueError` + custom errors).
- Keep logging imports and `logger` setup at the top of each module.
- Consolidate metrics increments in boundary functions (avoid mixed helper-level increments).
- Keep `state.py` side effects minimal and delayed where possible.
