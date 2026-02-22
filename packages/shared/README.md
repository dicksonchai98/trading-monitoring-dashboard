# Shared Packages

Minimal shared code for build-time usage only.

## Folders
- `contracts`: shared data contracts (events, snapshots, role enums)
- `config`: shared environment schema and config helpers

## Rules
- Shared packages MUST NOT import from `apps/*`
- Frontend and backend build artifacts remain independent
