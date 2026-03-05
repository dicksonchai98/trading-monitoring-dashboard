1. Design Goals

Aggregator should follow the actual contract code carried in each Redis Stream entry, so Redis state keys and Postgres persistence always align with ingestor output (e.g., TXFC6). This removes manual env updates when contracts roll.

2. Scope

In scope:
- Read `code` from stream entry payload for tick/bidask.
- Use that `code` when writing Redis state keys.
- Use that `code` when persisting `kbars_1m` rows.

Out of scope:
- Multi-stream discovery beyond configured stream keys.
- Changing ingestor behavior.
- Backfill or replay logic.

3. Data Flow Changes

Redis Streams (tick / bidask)
|
v
Aggregator
- Parse stream entry fields
- Extract `code` from entry payload
- Route writes by extracted code
|
v
Redis State
- current K (Hash) keyed by code
- K ZSET (today) keyed by code
- latest metric (String JSON) keyed by code
- metric ZSET (1s sampling) keyed by code
|
v
Postgres (kbars_1m) with code from entry

4. Behavior Details

- If `code` is missing or invalid in entry payload:
  - Drop the entry and increment an error counter.
- Tick state machine is per-code; state is isolated by code.
- Bidask state machine is per-code; sampling/carry-forward is per-code.

5. Error Handling

- Malformed payload or missing `code` -> drop + metric increment.
- Redis/PG write failure -> no ACK (existing at-least-once policy).

6. Testing

- Update integration tests to inject stream entries with a non-default code (e.g., TXFC6) and assert Redis keys and Postgres rows use that code.
- Add a test for missing `code` that asserts drop counter increments and no ACK.

7. Notes

- Environment `AGGREGATOR_CODE` becomes optional; aggregator routing uses entry `code`.
