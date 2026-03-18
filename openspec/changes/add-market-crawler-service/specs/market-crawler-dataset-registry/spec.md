## ADDED Requirements

### Requirement: Dataset Registry Startup Validation
The system SHALL load crawler dataset definitions from configuration files at worker startup and fail fast if any dataset contract is invalid.

#### Scenario: Duplicate dataset code exists
- **WHEN** two dataset configs declare the same `dataset_code`
- **THEN** worker startup SHALL fail and report a dataset registry initialization error

#### Scenario: Unresolvable pipeline binding
- **WHEN** a dataset config references a parser, normalizer, or validator that is not registered
- **THEN** worker startup SHALL fail before accepting any crawler job

### Requirement: Dataset-Only Runtime Lookup
The system SHALL resolve crawler execution by `dataset_code` through the registry and SHALL NOT require direct file path references at runtime.

#### Scenario: Job execution starts
- **WHEN** orchestrator receives `dataset_code` and `target_date`
- **THEN** it SHALL obtain all dataset source/schedule/storage bindings from the dataset registry
