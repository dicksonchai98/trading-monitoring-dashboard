# Frontend SSE Integration Design (Phase 1 MVP)

## 1. Purpose

This document defines the Phase 1 MVP design for integrating SSE into the frontend dashboard.

The frontend is built with:

- React
- Zod
- Zustand
- React Query

The backend is built with FastAPI and provides realtime futures market data through SSE, including:

- Tick
- BidAsk

The main goal is to let multiple dashboard pages share the same realtime data source while keeping the UI stable and avoiding excessive rerenders or visual jitter.

---

## 2. Scope

Phase 1 MVP includes:

- One shared SSE connection for the dashboard
- Zod validation for incoming SSE payloads
- Zustand as shared realtime state
- React Query for initial snapshot data
- Buffered updates to reduce UI jitter
- Basic reconnect handling

Phase 1 MVP does not include:

- Dynamic symbol subscription
- Advanced reconnect strategy
- Heartbeat detection
- Web Worker optimization
- Snapshot resync after disconnect

---

## 3. Design Goals

1. Reuse one SSE connection across multiple pages
2. Keep realtime state centralized and easy to consume
3. Prevent UI jitter caused by high-frequency tick/bidask updates
4. Keep the MVP simple and easy to extend later

---

## 4. High-Level Architecture

```text
FastAPI REST API -> React Query snapshot
FastAPI SSE API  -> SSE Manager -> Zod validation -> Buffer -> Zustand -> UI
Responsibility split
React Query
fetch initial snapshot
handle normal REST API data
SSE Manager
manage EventSource lifecycle
receive and parse SSE events
validate payloads with Zod
write normalized data into buffer
flush buffered updates into Zustand
Zustand
store latest tick state
store latest bidask state
store connection status
5. Data Flow
Initial load
Page loads
React Query fetches initial snapshot from REST API
UI renders snapshot first
SSE manager starts or reuses existing connection
Incoming events update Zustand through buffered flushes
Realtime update
SSE message
-> JSON parse
-> Zod validation
-> normalize
-> write to memory buffer
-> flush every 200ms
-> update Zustand
-> affected UI rerender
6. SSE Event Model

The frontend assumes the backend sends events with explicit type information.

Tick example
{
  "type": "tick",
  "symbol": "MTX",
  "ts": 1711111111111,
  "data": {
    "close": 19532,
    "volume": 2,
    "totalVolume": 12345
  }
}
BidAsk example
{
  "type": "bidask",
  "symbol": "MTX",
  "ts": 1711111111120,
  "data": {
    "bidPrice": [19531, 19530, 19529, 19528, 19527],
    "bidVolume": [10, 8, 5, 3, 2],
    "askPrice": [19532, 19533, 19534, 19535, 19536],
    "askVolume": [9, 7, 6, 4, 2]
  }
}
7. State Design
7.1 Connection State
type SseConnectionStatus = "idle" | "connecting" | "connected" | "error";
7.2 Tick State
type TickViewModel = {
  symbol: string;
  close: number;
  volume: number;
  totalVolume?: number;
  lastUpdateTs: number;
};
7.3 BidAsk State
type BidAskLevel = {
  price: number;
  volume: number;
};

type BidAskViewModel = {
  symbol: string;
  bids: BidAskLevel[];
  asks: BidAskLevel[];
  lastUpdateTs: number;
};
7.4 Zustand Shape
type RealtimeStore = {
  connectionStatus: SseConnectionStatus;
  ticksBySymbol: Record<string, TickViewModel>;
  bidasksBySymbol: Record<string, BidAskViewModel>;
};
8. Zod Validation

All incoming SSE payloads must be validated before entering the store.

Tick schema
const TickEventSchema = z.object({
  type: z.literal("tick"),
  symbol: z.string(),
  ts: z.number(),
  data: z.object({
    close: z.number(),
    volume: z.number(),
    totalVolume: z.number().optional(),
  }),
});
BidAsk schema
const BidAskEventSchema = z.object({
  type: z.literal("bidask"),
  symbol: z.string(),
  ts: z.number(),
  data: z.object({
    bidPrice: z.array(z.number()),
    bidVolume: z.array(z.number()),
    askPrice: z.array(z.number()),
    askVolume: z.array(z.number()),
  }),
});
9. Buffer Strategy

To avoid UI jitter, the frontend should not update Zustand on every event.

MVP approach
Keep only the latest tick per symbol in memory
Keep only the latest bidask per symbol in memory
Flush buffered updates into Zustand every 200ms
Why

This reduces:

excessive rerenders
table flicker
number jumping
frontend CPU load

This is acceptable because the dashboard needs a stable latest view, not every raw tick rendered immediately.

10. SSE Connection Management

The frontend should use one global SSE manager.

Responsibilities
open EventSource
listen for onopen, onmessage, onerror
parse JSON
validate payload with Zod
normalize event
write to buffer
flush buffer to Zustand
handle basic reconnect
Rule

Do not create SSE connections inside individual pages, tables, or rows.

11. React Query Integration

React Query should be used for initial snapshot data.

Merge rule

UI should prefer realtime data if available; otherwise fallback to snapshot data.

Example:

const displayedTick = realtimeTick ?? snapshotTick;

This ensures the page is not empty before the first SSE event arrives.

12. UI Consumption Pattern

To reduce rerenders, components should subscribe only to the data they need.

Recommended
each row reads only its own symbol
use selector-based hooks
keep table row keys stable
Example hooks
useRealtimeConnection()
useTick(symbol)
useBidAsk(symbol)
Avoid
subscribing the whole table to the full realtime store
recomputing all rows on every update
13. Error Handling
Invalid JSON
ignore event
log error
continue stream
Invalid schema
ignore event
log validation error
continue stream
SSE error
set connection state to error
close connection
retry after fixed delay, such as 3 seconds
14. Recommended Folder Structure
src/
  modules/
    realtime/
      schemas/
        marketEvent.schema.ts
      adapters/
        tick.adapter.ts
        bidask.adapter.ts
      services/
        realtimeManager.ts
        realtimeBuffer.ts
      store/
        realtime.store.ts
      hooks/
        useRealtimeConnection.ts
        useTick.ts
        useBidAsk.ts
      types/
        realtime.types.ts
15. Final Recommendation

For Phase 1 MVP, the recommended design is:

use React Query for initial snapshot
use one global SSE manager
use Zod for payload validation
use Zustand for shared realtime state
use latest-only memory buffer
flush updates every 200ms
let UI consume data through symbol-level selector hooks

This design is simple, stable, and suitable as the first version of a dashboard SSE integration.
```
