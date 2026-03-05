# Redis + RedisInsight Compose Design

Date: 2026-03-03

## Goal
Add Redis and RedisInsight services to the existing Docker Compose setup so developers can run the full stack locally without installing Redis on the host.

## Scope
- Add `redis` service with persistent volume
- Add `redisinsight` service with UI exposed on port 5540
- Keep existing backend/frontend services unchanged
- No code changes in app services

## Architecture
- Compose default network is used
- RedisInsight connects to Redis via service name `redis:6379`
- Redis data stored in a named volume `redis_data`

## Risks & Mitigations
- RedisInsight may start before Redis: acceptable; UI can retry connection
- Port 5540 conflict: document the port and allow override via env if needed later

## Testing
- `docker compose up -d`
- Open `http://localhost:5540`
- Add a database connection pointing to host `redis` and port `6379`
