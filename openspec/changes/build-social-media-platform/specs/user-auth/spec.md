## ADDED Requirements

### Requirement: User registration with phone and email
The system SHALL allow new users to register with phone number, user name, email, and password. The system MUST reject registration when phone number or email already exists.

#### Scenario: Successful registration
- **WHEN** a guest submits a unique phone number, unique email, valid user name, and valid password
- **THEN** the system creates a new user record and redirects to the login page

#### Scenario: Duplicate registration data
- **WHEN** a guest submits a phone number or email that already exists
- **THEN** the system rejects the registration and returns a validation error

### Requirement: Secure password storage
The system MUST hash passwords with `PasswordHasher<User>` before persisting user credentials. The system MUST NOT store plaintext passwords.

#### Scenario: Password persisted securely
- **WHEN** a new user is created
- **THEN** the stored credential value is a password hash and no plaintext password is persisted

### Requirement: Login with cookie claims
The system SHALL authenticate users by phone number and password, and MUST issue an authentication cookie containing claims for UserId, PhoneNumber, and DisplayName on successful login.

#### Scenario: Successful login
- **WHEN** a user submits valid phone number and password
- **THEN** the system signs in the user with cookie authentication and redirects to posts index

#### Scenario: Failed login
- **WHEN** a user submits invalid credentials
- **THEN** the system denies authentication and returns an error message without creating an auth cookie
