## 1. Source-of-Truth Alignment

- [x] 1.1 Cross-check proposal/design/specs against `docs/plans/2026-04-06-tick-bidask-extensions-and-spread-design.md` and `docs/plans/2026-02-16-futures-dashboard-design.md` for contract mismatches.
- [x] 1.2 Confirm spread futures source contract is explicit and consistent across artifacts (`futures_code=AGGREGATOR_CODE`, state key template, field `close`, freshness fallback).
- [x] 1.3 Resolve any artifact gaps and update OpenSpec files before implementation.

## 2. Tick Worker Extension

- [x] 2.1 Add `amplitude` and `amplitude_pct` computation in tick bar lifecycle and include them in current/archive payload serialization.
- [x] 2.2 Extend tick persistence path/model/migration for `kbars_1m` to store `amplitude` and `amplitude_pct`.
- [x] 2.3 Add/adjust unit and integration tests for formula correctness and invalid-open failure behavior.

## 3. BidAsk Worker Extension

- [x] 3.1 Compute `main_force_big_order` from normalized total bid/ask volume basis.
- [x] 3.2 Track and emit day high/low and clamped strength fields in latest and zset payloads.
- [x] 3.3 Persist new bidask fields into `bidask_metrics_1s.metric_payload` and add tests.

## 4. Market Summary Spread Extension

- [x] 4.1 Extend market summary snapshot schema with futures/spread fields and `spread_status`.
- [x] 4.2 Read futures latest from `{env}:state:{AGGREGATOR_CODE}:{trade_date}:k:current`, parse `close`, apply freshness guard.
- [x] 4.3 Compute spread day high/low and clamped strength; write stale/null outputs when futures latest is missing or stale.
- [x] 4.4 Extend market summary DB model/migration for spread-related columns and add persistence tests.

## 5. Serving Contract and Compatibility

- [x] 5.1 Update serving normalization/helpers to include new tick/bidask/market fields without breaking existing keys/contracts.
- [x] 5.2 Add API/SSE contract tests for extended payload presence and stale spread behavior.

## 6. Observability and Validation

- [x] 6.1 Add compute/stale/failure metrics and wire alert-threshold-ready counters/gauges.
- [x] 6.2 Run focused backend test suite covering modified workers, serving contracts, and regressions.
- [x] 6.3 Run OpenSpec strict validation for the change and fix findings.
