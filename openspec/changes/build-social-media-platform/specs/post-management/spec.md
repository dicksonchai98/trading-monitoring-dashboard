## ADDED Requirements

### Requirement: Authenticated post creation
The system SHALL allow authenticated users to create posts with required content and optional image URL.

#### Scenario: Create post successfully
- **WHEN** an authenticated user submits valid post content
- **THEN** the system creates a new post linked to the current user

### Requirement: Post ownership authorization
The system MUST enforce that only the post creator can edit or delete that post.

#### Scenario: Owner edits post
- **WHEN** the current user is the post owner and submits a valid edit
- **THEN** the system updates the post

#### Scenario: Non-owner attempts deletion
- **WHEN** the current user is not the post owner and requests delete
- **THEN** the system denies the operation with unauthorized result

### Requirement: Login required for write operations
The system MUST require authentication for post create, edit, and delete operations.

#### Scenario: Unauthenticated create request
- **WHEN** an unauthenticated user attempts to create a post
- **THEN** the system redirects to login or returns unauthorized response
