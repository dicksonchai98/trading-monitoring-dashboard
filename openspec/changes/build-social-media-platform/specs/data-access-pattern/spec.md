## ADDED Requirements

### Requirement: Schema evolution via EF Core migrations
The system SHALL manage table, index, and foreign key schema changes through EF Core migrations.

#### Scenario: Apply initial migration
- **WHEN** the initial migration is executed
- **THEN** the database schema for users, posts, and comments is created as defined

### Requirement: Repository data access boundary
The system MUST route business data access through Repository layer and MUST NOT allow Controllers to access DbContext directly.

#### Scenario: Controller write flow
- **WHEN** a controller handles a create or update request
- **THEN** the controller delegates to service and repository layers for persistence

### Requirement: Parameterized SQL or stored procedures only
The system MUST execute SQL through stored procedures or parameterized queries and MUST NOT concatenate raw user input into SQL strings.

#### Scenario: User lookup by phone
- **WHEN** login needs user lookup by phone number
- **THEN** the repository executes a stored procedure or parameterized query with bound phone parameter
