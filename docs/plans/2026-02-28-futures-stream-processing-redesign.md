# Futures Stream Processing Redesign (2026-02-28)

## Scope

- Domain: `01-market-data-ingestion` + downstream realtime indicator consumption
- Instruments: Futures near-month continuous contract (`TXFR1`)
- Data mode: Realtime with **same-day replay** and **gap fill** (no external historical source)
- Quote types: `tick`, `bidask`, `quote`
- Primary downstream: 1-minute K-line built from `tick` stream

## Motivation

The 2026-02-27 design is insufficient for:
- Strict per-quote-type ordering
- Deterministic replay
- Gap detection and fill

This redesign keeps Shioaji as the source but restructures stream topology and replay mechanics.

## Architecture Summary

- Single shared Shioaji connection.
- Each `quote_type` maintains its own `ingest_seq` (monotonic).
- Producer writes to **master streams** per quote type.
- Producer **fans out** into per-consumer streams so every consumer gets full data.
- Consumers detect gaps with `ingest_seq` and call Backfill API.
- Late events within 2 minutes can **correct** 1-minute K-line outputs.

## Stream Topology

Master streams (single write source):
- `stream:futures:txfr1:tick`
- `stream:futures:txfr1:bidask`
- `stream:futures:txfr1:quote`

Fan-out streams (one per consumer group):
- `stream:futures:txfr1:{quote_type}:cg:{consumer_name}`

## Event Contract (Additions)

All event types add:
- `ingest_seq`: integer, per quote type
- `ts_event`: source timestamp (ordering reference)
- `ts_ingest`: optional, ingestion time (latency tracking)
- `event_id`: optional, `{quote_type}-{ingest_seq}`

## Ordering, Late Events, and Corrections

- Ordering is guaranteed **within each quote type only**.
- `ts_event` is the primary chronological ordering field.
- `ingest_seq` is authoritative for gap detection and de-duplication.
- Late events:
  - If late event is within **2 minutes** of minute close, recompute K-line.
  - Publish a `correction` event on the **same K-line stream**.
  - Late events beyond 2 minutes are logged and dropped (no correction).

## Backfill / Replay

- Trigger: consumer sees `ingest_seq` gap.
- API: HTTP backfill endpoint.
  - Request: `symbol`, `quote_type`, `from_seq`, `to_seq`
  - Response: ordered list of events
- Data source: Redis Streams (no external historical API).
- Retention: **day session + 1 hour buffer**
  - Standard day: 08:45–14:45 (Taiwan time)
  - Final trading day: 08:45–14:30

## Fan-out and Consumer Model

- Fan-out streams allow every consumer to receive full data.
- Each consumer uses **consumer groups** for ack/pending/retry.
- New consumers are added by creating a new fan-out stream.

## Reliability and Error Handling

- Shioaji reconnect with exponential backoff.
- Normalization failures: drop + structured logs.
- Redis publish failure: short retry + metrics.
- Consumer failures: retry then dead-letter.

## Observability

- `ingestion_events_total{quote_type,status}`
- `redis_publish_total{quote_type,status}`
- `reconnect_total`
- `gap_detected_total{quote_type}`
- `backfill_requests_total{quote_type,status}`
- `correction_events_total`

## Testing Strategy

- Unit: normalizers, `ingest_seq`, gap detection, correction generation.
- Integration: producer -> master -> fan-out -> consumer.
- Resilience: reconnect, Redis write failure, backfill request path.

## Compatibility Notes

- This redesign supersedes `docs/plans/2026-02-27-futures-ingestion-design.md`.
- If conflicts arise with existing OpenSpec artifacts, update them alongside this design.
