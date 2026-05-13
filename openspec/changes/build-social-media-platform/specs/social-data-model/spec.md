## ADDED Requirements

### Requirement: Core social entities and relationships
The system SHALL define Users, Posts, and Comments entities with relational integrity between users-posts and users/posts-comments.

#### Scenario: Relational integrity enforced
- **WHEN** a post or comment is inserted with a non-existent foreign key user or post
- **THEN** the database rejects the write due to foreign key constraints

### Requirement: Unique identity constraints
The system MUST enforce unique constraints for Users.Email and Users.PhoneNumber.

#### Scenario: Duplicate email insert
- **WHEN** an insert attempts to reuse an existing email
- **THEN** the database rejects the insert with a unique constraint violation

### Requirement: Required and optional field rules
The system MUST require non-null fields for identity and content columns, and SHALL allow nullable fields only for explicitly optional attributes such as profile cover image, biography, and post image.

#### Scenario: Missing required content
- **WHEN** a post is created without content
- **THEN** the write is rejected by validation or database constraints

### Requirement: Soft delete schema support
The system MUST provide soft delete support for posts and comments by persisting deletion markers and excluding deleted records from default read paths.

#### Scenario: Soft-deleted post visibility
- **WHEN** a post is marked deleted
- **THEN** default list and detail queries do not return the deleted post
