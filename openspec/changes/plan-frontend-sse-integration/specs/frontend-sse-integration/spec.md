## ADDED Requirements

### Requirement: Frontend SSE contract SHALL align with backend serving stream
The frontend SSE integration capability SHALL treat `GET /v1/stream/sse` as the authoritative serving stream endpoint and SHALL model only the backend-emitted event names `kbar_current`, `metric_latest`, and `heartbeat`.

#### Scenario: Event contract baseline is established
- **WHEN** frontend SSE integration requirements are defined for Phase 1
- **THEN** the documented stream endpoint is `/v1/stream/sse`
- **AND** the documented event set is exactly `kbar_current`, `metric_latest`, and `heartbeat`
- **AND** direct `tick` / `bidask` event assumptions are excluded from the contract

### Requirement: Frontend SHALL define a single shared SSE management architecture
The frontend SHALL define one app-level SSE manager and one centralized realtime state contract to avoid per-page connection ownership.

#### Scenario: Connection ownership is centralized
- **WHEN** SSE architecture is specified for frontend
- **THEN** the design assigns connection lifecycle to a shared manager module
- **AND** page-level components are specified as consumers rather than connection owners

### Requirement: Frontend SHALL define validation boundaries for serving SSE payloads
The frontend SHALL define payload validation requirements for `kbar_current`, `metric_latest`, and `heartbeat` before data enters shared realtime state.

#### Scenario: Invalid payload handling is deterministic
- **WHEN** an incoming SSE payload fails JSON parsing or schema validation
- **THEN** the event is ignored
- **AND** an error is recorded for diagnostics
- **AND** stream processing remains active for subsequent events

### Requirement: Frontend integration SHALL respect backend runtime constraints
The frontend SSE capability SHALL explicitly account for backend auth and throttling behavior, including Bearer authentication, rate-limit behavior, and per-client SSE connection limits.

#### Scenario: Runtime constraints are captured in requirements
- **WHEN** frontend SSE integration constraints are documented
- **THEN** requirements include Bearer auth dependency for `/v1/stream/sse`
- **AND** requirements include rate-limit and SSE slot-limit failure handling expectations
- **AND** requirements include heartbeat/poll behavior awareness for connection health

### Requirement: Phase 1 SHALL exclude page-level stream rendering integration
Phase 1 of this capability SHALL be limited to contract and architecture baseline definition and SHALL NOT require wiring stream data into specific pages or widgets.

#### Scenario: Scope boundaries are enforced
- **WHEN** Phase 1 deliverables are evaluated
- **THEN** proposal/design/spec artifacts are complete for contract and architecture baseline
- **AND** page-level stream consumption tasks remain deferred to the next phase

### Requirement: Frontend SHALL define a pre-implementation auth transport decision point
Before implementing authenticated SSE consumption, the frontend capability SHALL define and approve one auth-compatible transport approach: a header-capable SSE client or a backend auth transport change compatible with native EventSource.

#### Scenario: Auth transport decision is treated as prerequisite
- **WHEN** Phase 2 implementation planning starts
- **THEN** the plan requires selection of exactly one approved auth transport path
- **AND** implementation does not proceed without this decision
