1. Purpose

Provide frontend-readable and real-time push capabilities, including:

1-minute K: today (Redis) + history (Postgres)

BidAsk metrics: latest (Redis) + today series (Redis ZSET, per second)

Realtime push: SSE (default) or WebSocket (optional)

2. Scope
   In Scope

REST APIs (query latest / today range / history range)

SSE push (K current + metric latest; optional "new archived K" notification)

Data sources: Redis state, Postgres

Basic rate limiting (IP/Token) and CORS

Health checks and basic metrics

Out of Scope

Complex frontend subscription protocol (multi-room, multi-instrument)

gap fill/replay

Metric computation (handled by L3)

Using Redis Streams for UI fan-out (consider in Phase 2)

3. Dependencies (Data Sources)
   Redis Keys (defined)

{env}:kbar:1m:current:{code} (Hash)

{env}:kbar:1m:{code} (ZSET, score=minute_ts, value=KBar JSON)

{env}:metric:bidask:latest:{code} (String JSON)

{env}:metric:bidask:today:{code} (ZSET, score=ts, value=JSON with fields whitelist)

Postgres

kbars_1m(code, minute_ts, open, high, low, close, volume)

4. API Spec (REST)
   4.1 Health

GET /health

Returns Redis/DB connection status and version info

4.2 1-minute K (today + current)
Get current K

GET /v1/kbar/1m/current?code=MTX

source: Redis Hash

response: KBar JSON (with minute_ts)

Get today K (range)

GET /v1/kbar/1m/today?code=MTX&from_ms=...&to_ms=...

source: Redis ZSET (ZRANGEBYSCORE)

response: [{minute_ts, open, high, low, close, volume}, ...]

If from/to omitted: default to recent N minutes (e.g., 240 minutes) to avoid huge pulls.

4.3 1-minute K (history)

GET /v1/kbar/1m/history?code=MTX&from=2026-03-01T00:00:00Z&to=2026-03-01T08:00:00Z

source: Postgres

response: same as today (minute_ts should be epoch ms or ISO; must be consistent)

4.4 BidAsk metrics (latest)

GET /v1/metric/bidask/latest?code=MTX

source: Redis GET latest key

response: latest JSON (with ts)

4.5 BidAsk metrics (today series)

GET /v1/metric/bidask/today?code=MTX&from_ms=...&to_ms=...

source: Redis ZSET (ZRANGEBYSCORE)

response: [{ts, imbalance, ratio, delta_bid_total_vol_1s, delta_ask_total_vol_1s}, ...]

If from/to omitted: default to recent N seconds (e.g., 3600 seconds)

4.6 Combined range query (optional but recommended)
Today + history in one API (frontend uses a single endpoint)

GET /v1/kbar/1m/range?code=MTX&from=...&to=...
Rules:

If the range includes today:

Today portion: Redis today

Earlier portion: Postgres history

Merge, sort, and return

5. Realtime Push (SSE, default)
   5.1 SSE endpoint

GET /v1/stream/sse?code=MTX

Event types (event name):

kbar_current: every 250ms–1000ms (based on UI)

metric_latest: every 250ms–1000ms

heartbeat: every 15s

Payload:

Use Redis latest/current JSON directly

5.2 Push strategy (MVP)

Poll Redis state (not Streams)

If ts/updated_at unchanged -> do not push (reduce traffic)

SSE disconnect -> frontend auto-reconnect

This is the fastest and most stable MVP approach; Phase 2 can move to event-driven (PubSub/Stream fanout).

6. WebSocket (optional)

If you prefer WS:
GET /v1/stream/ws?code=MTX

message schema same as SSE

keepalive ping/pong

7. Security and Rate Limiting (MVP)

CORS: allow frontend domain

Auth: simple Bearer token (env-configured)

Rate limit:

REST: N requests per IP per minute

SSE: per-IP concurrent connections limit (e.g., 3)

8. Error Codes

400: missing/invalid parameters

404: Redis has no data

503: Redis/DB unavailable

429: rate limit

9. Acceptance Criteria

REST endpoints read Redis/Postgres correctly

SSE pushes current K and metric latest (only when changed)

After reconnect, latest state is still received

Missing parameters have safe defaults and will not cause huge pulls

Basic rate limiting is effective
