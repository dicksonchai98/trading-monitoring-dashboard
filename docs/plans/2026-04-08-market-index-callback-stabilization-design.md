# Market Index Callback Stabilization Design

## 1. Context

Current ingestion behavior successfully subscribes index market data, but index events are not reliably entering the market callback path, causing missing writes to Redis market stream.

Observed risk points:

- Index callback registration is version-dependent and currently falls back through mixed callback candidates.
- Spot and index may share stock-style callback surfaces, creating routing ambiguity.
- Index contract payload/code can appear as `001` while downstream market worker expects `TSE001`.

Goal for this change: stabilize index ingestion with minimum-risk, minimum-scope updates for fast recovery.

## 2. Goals and Non-Goals

### Goals

- Ensure index market events are reliably captured and written to Redis stream.
- Keep existing futures and spot ingestion behavior unchanged.
- Canonicalize market stream code to `TSE001` for downstream consistency.

### Non-Goals

- Full callback framework refactor.
- Multi-index support.
- Re-architecture of ingestion runtime.

## 3. Decision Summary

### 3.1 Subscription and callback split

- Spot path remains:
  - `subscribe(..., quote_type=Tick, version=v1)`
  - `set_on_tick_stk_v1_callback -> _on_spot_quote`
- Market/index path changes to:
  - `subscribe(index_contract, quote_type=Quote, version=v1)`
  - `set_on_quote_stk_v1_callback -> _on_market_quote`
- Futures path remains:
  - `set_on_tick_fop_v1_callback`
  - `set_on_bidask_fop_v1_callback`

Rationale: avoid relying on SDK-specific `tick_idx` callback names and avoid spot/index callback contention.

### 3.2 Canonical market code

- All market events are normalized to canonical code `TSE001` before enqueue.
- Raw upstream payload is preserved in `payload.raw_quote` for diagnostics.

Rationale: prevent split writes between `...:market:001` and `...:market:TSE001`.

### 3.3 Redis stream contract

- Market stream write key is always:
  - `{env}:stream:market:TSE001`
- `...:stream:market:001` is no longer produced by ingestion path.

Rationale: align with existing worker defaults (`MARKET_CODE=TSE001`) and avoid hidden data drift.

## 4. Data Flow

1. Resolve index contract from `Contracts.Indexs` (`TSE001` or `001` contract forms accepted).
2. Subscribe market contract with `quote_type=Quote`, `version=v1`.
3. Receive market callback via `set_on_quote_stk_v1_callback`.
4. Normalize event envelope:
   - `code = "TSE001"`
   - `quote_type = "market"`
   - market payload fields + `raw_quote`
5. Enqueue via existing queue->writer pipeline.
6. Write to Redis stream key `{env}:stream:market:TSE001`.

## 5. Error Handling

- Invalid or incomplete market payloads are logged and skipped without impacting spot/futures paths.
- Callback exceptions are contained to avoid breaking quote session loop.
- Existing reconnect/resubscribe policy remains unchanged.

## 6. Test Plan

Update/add tests to cover:

- Market subscription uses `QuoteType.Quote` with v1.
- Market callback registration uses `set_on_quote_stk_v1_callback`.
- Market event code normalization:
  - Input code/payload `001` still writes stream key `...:market:TSE001`.
- No regressions for:
  - spot tick ingestion path
  - futures tick/bidask path

## 7. Rollout and Verification

1. Deploy with `INGESTOR_MARKET_ENABLED=true`, `INGESTOR_MARKET_CODE=TSE001`.
2. Confirm subscription success logs (`event_code=16`) for market contract.
3. Verify Redis writes only to `{env}:stream:market:TSE001`.
4. Verify `market_summary_worker` consumes and updates market state.
5. Monitor for unexpected spot/futures error metric changes.

Rollback:

- Revert this change and disable `INGESTOR_MARKET_ENABLED` if needed.
- Futures/spot paths remain isolated and unaffected.

## 8. Selected Approach

Selected approach is the minimum-change stabilization path:

- keep runtime architecture intact
- fix market callback/subscription pair
- enforce canonical market stream code

This provides fastest recovery with low blast radius.
