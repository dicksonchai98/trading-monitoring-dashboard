# Backend

FastAPI modular monolith for ingestion, processing, auth, subscription, and realtime delivery.

## Local Structure (MVP)

- `app/main.py`: FastAPI entrypoint and router registration
- `app/routes/`: auth, billing, realtime, analytics, admin routes
- `app/services/`: auth, token, denylist, metrics, audit services
- `app/deps.py`: shared authn/authz dependencies
- `tests/`: acceptance-oriented API tests

## Run (example)

```bash
uvicorn app.main:app --reload
pytest
```
