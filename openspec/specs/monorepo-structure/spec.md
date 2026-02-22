# Monorepo Structure

## Purpose

TBD. This spec defines the required monorepo layout and module boundary rules.

## Requirements

### Requirement: Monorepo directory structure is defined
The repository SHALL define a top-level structure that separates deployable apps from shared packages, including `apps/` and `packages/` as root directories.

#### Scenario: Standard repo layout exists
- **WHEN** the repository is initialized
- **THEN** top-level directories `apps/` and `packages/` exist and are used as the primary entry points for services and shared modules

### Requirement: Frontend and backend are separated
The frontend SHALL reside in `apps/frontend` and the backend SHALL reside in `apps/backend`.

#### Scenario: App locations are fixed
- **WHEN** the monorepo structure is inspected
- **THEN** `apps/frontend` and `apps/backend` exist and contain their respective codebases

### Requirement: Shared contracts and config are centralized
Shared contracts and config SHALL be placed under `packages/shared/contracts` and `packages/shared/config`.

#### Scenario: Shared package locations exist
- **WHEN** shared modules are created
- **THEN** they are located under `packages/shared/contracts` and `packages/shared/config`

### Requirement: Module boundary rules are documented
The repository SHALL document dependency direction rules: `apps/*` may depend on `packages/shared/*`, and `packages/shared/*` MUST NOT depend on `apps/*`.

#### Scenario: Boundary rules are discoverable
- **WHEN** a developer checks the documentation
- **THEN** the allowed dependency directions are explicitly stated

### Requirement: Domain modules are isolated
Domain services SHALL reside under `apps/<domain>` and MUST NOT directly depend on other domain services.

#### Scenario: Cross-domain dependency is prevented
- **WHEN** a domain service attempts to import or reference another domain service directly
- **THEN** the dependency is considered invalid and must be refactored into a shared module

### Requirement: Shared modules are explicit and reusable
Shared modules SHALL be placed under `packages/shared/*` and MUST NOT depend on `apps/*` modules.

#### Scenario: Shared module usage
- **WHEN** an app needs common functionality (config, logging, utils)
- **THEN** it imports from `packages/shared/*` and no shared module imports from `apps/*`

### Requirement: Module visibility is constrained
Each app and shared module SHALL expose a single public entry (such as `index.ts` or equivalent) for external imports.

#### Scenario: Public API boundary
- **WHEN** another module imports from an app or shared module
- **THEN** it uses only the public entry and not internal file paths
