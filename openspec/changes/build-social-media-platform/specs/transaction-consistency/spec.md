## ADDED Requirements

### Requirement: Atomic multi-step data updates
The system MUST execute multi-step operations that affect related records within an explicit database transaction when one logical action spans multiple writes.

#### Scenario: Delete post with related comment updates
- **WHEN** a delete post operation updates both post and related comments
- **THEN** the operation commits only if all updates succeed; otherwise all changes are rolled back

### Requirement: Transaction rollback on failure
The system MUST rollback the active transaction when any write in the transactional scope fails.

#### Scenario: Failure in second update
- **WHEN** the first update succeeds but a later update fails in the same transaction scope
- **THEN** none of the transactional writes remain persisted
