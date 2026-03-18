## Context

Market ingestion currently owns Shioaji login/session setup, and the historical backfill job will need the same credentials and login flow. Today the ingestion runner constructs its own Shioaji API client and wraps it with `ShioajiClient`, which risks duplicated logic when backfill is introduced. We need a shared entry point to keep credentials, simulation mode, and login sequence consistent across services.

## Goals / Non-Goals

**Goals:**
- Provide a shared Shioaji session factory to standardize API/client construction and login flow.
- Update market ingestion to use the shared factory instead of constructing clients directly.
- Ensure historical backfill can reuse the same session factory without diverging on credentials or login steps.

**Non-Goals:**
- Redesign the ingestion pipeline, subscription logic, or reconnect behavior.
- Change Shioaji credentials, configuration names, or runtime environment variables.
- Implement historical backfill itself (this change only prepares shared session setup).

## Decisions

- **Create a shared session factory module** (e.g., `app/services/shioaji_session.py`):
  - Expose `build_shioaji_api()` and `build_shioaji_client()` that encapsulate `sj.Shioaji(simulation=SHIOAJI_SIMULATION)` and the `ShioajiClient` wrapper.
  - Rationale: keeps Shioaji construction in one place, avoids duplication, and makes future services (backfill) opt into the same contract.
  - Alternative considered: keep construction in `state.py` and duplicate in backfill. Rejected due to drift risk and harder maintenance.

- **Market ingestion uses the factory**:
  - `build_ingestor_runner()` consumes `build_shioaji_client()` (or `build_shioaji_api()` + `ShioajiClient`) instead of constructing the session inline.
  - Rationale: ensures ingestion follows the shared login/session path.

- **Login flow alignment**:
  - Keep the existing `ShioajiClient.login()` behavior (`api.login(..., fetch_contract=False)`), and explicitly call `fetch_contracts()` where needed.
  - Rationale: preserves the established sequence used by ingestion and required by backfill for contract context.

## Risks / Trade-offs

- [Risk] Factory location choice could introduce circular imports if placed in `state.py` → Mitigation: keep factory in a small `app/services/shioaji_session.py` module with minimal dependencies.
- [Risk] Backfill might need additional Shioaji settings later (timeouts, proxies) → Mitigation: extend factory with optional parameters while keeping defaults consistent.
- [Trade-off] Slight indirection for ingestion setup → Acceptable for consistency and maintainability.