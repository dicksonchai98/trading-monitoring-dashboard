## ADDED Requirements

### Requirement: Authenticated comment creation
The system SHALL allow authenticated users to add comments to existing posts.

#### Scenario: Add comment successfully
- **WHEN** an authenticated user submits valid comment content on an existing post
- **THEN** the system creates a comment linked to the current user and target post

### Requirement: Post existence validation for comments
The system MUST validate that the target post exists before creating a comment.

#### Scenario: Comment on missing post
- **WHEN** a user submits a comment for a post id that does not exist
- **THEN** the system rejects the request with not found or validation error

### Requirement: Login required for comment writes
The system MUST require authentication for adding comments.

#### Scenario: Unauthenticated comment attempt
- **WHEN** an unauthenticated user attempts to add a comment
- **THEN** the system redirects to login or returns unauthorized response
