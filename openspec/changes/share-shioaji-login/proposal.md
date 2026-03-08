## Why

Market ingestion owns Shioaji login/session setup today, and the upcoming historical backfill will need the same credentials and login flow. Without a shared entry point, we will duplicate sensitive connection logic and risk drift.

## What Changes

- Introduce a shared Shioaji session factory that standardizes login/session creation across services.
- Update market ingestion to use the shared factory instead of instantiating the client directly.
- Define the backfill job’s usage of the shared factory so ingestion and backfill remain aligned on credentials and login flow.

## Capabilities

### New Capabilities
- `shioaji-session-factory`: Shared construction of Shioaji API/client with consistent credential and login setup for ingestion and backfill.

### Modified Capabilities
- (none)

## Impact

- Backend services: `app/market_ingestion` and new/shared session module (e.g., `app/state.py` or `app/services/shioaji_session.py`).
- Runtime configuration: `SHIOAJI_API_KEY`, `SHIOAJI_SECRET_KEY`, `SHIOAJI_SIMULATION` remain the single source of truth.
- Documentation: update backfill job design to reference the shared factory.