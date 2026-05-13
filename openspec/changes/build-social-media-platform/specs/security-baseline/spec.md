## ADDED Requirements

### Requirement: CSRF protection on all POST forms
The system MUST include anti-forgery tokens in all POST forms and MUST validate them server-side.

#### Scenario: Missing anti-forgery token
- **WHEN** a POST request is submitted without a valid anti-forgery token
- **THEN** the system rejects the request

### Requirement: XSS-safe rendering for user content
The system MUST render user-generated post and comment content using HTML encoding and MUST NOT render raw HTML by default.

#### Scenario: Script payload in content
- **WHEN** a user submits script-like text in post or comment content
- **THEN** the rendered page displays escaped text rather than executing script

### Requirement: Secure authentication cookie settings
The system MUST configure authentication cookies with secure defaults including HttpOnly and SameSite, and MUST use Secure in HTTPS environments.

#### Scenario: Cookie issued on login
- **WHEN** a user logs in successfully
- **THEN** the auth cookie includes secure attributes per environment policy

### Requirement: Input binding and validation safety
The system MUST bind request data through dedicated ViewModels and enforce validation rules for required fields and input length limits.

#### Scenario: Over-posted payload fields
- **WHEN** a client submits fields not present in the intended ViewModel
- **THEN** those fields are ignored and do not modify protected entity properties

### Requirement: Responsive Razor UI baseline
The system MUST implement user-facing Razor pages with Bootstrap-based responsive layouts for key auth, post, and comment flows.

#### Scenario: Mobile viewport usability
- **WHEN** a user opens register, login, and posts pages on a mobile viewport
- **THEN** forms and primary actions remain usable without horizontal overflow
