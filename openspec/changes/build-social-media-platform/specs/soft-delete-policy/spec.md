## ADDED Requirements

### Requirement: Soft delete behavior for post and comment removal
The system MUST perform logical deletion for posts and comments by setting deletion flags instead of physically removing records in default delete flows.

#### Scenario: Delete post request
- **WHEN** a post owner deletes a post
- **THEN** the system marks the post as deleted rather than physically deleting the row

### Requirement: Default read filtering for deleted content
The system MUST exclude soft-deleted posts and comments from default list and detail queries.

#### Scenario: Fetch post timeline
- **WHEN** the system queries posts for timeline display
- **THEN** rows marked as deleted are excluded from results
