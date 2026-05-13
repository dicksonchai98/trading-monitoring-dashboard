## 1. Project Skeleton and Architecture

- [x] 1.1 Create/align project folders and base classes for Controllers, Services, Repositories, Entities, ViewModels, Common, and Data layers.
- [x] 1.2 Register DI bindings for service and repository interfaces in Program startup.
- [x] 1.3 Enforce architectural boundary so Controllers do not directly depend on DbContext.

## 2. Data Model and Migrations

- [x] 2.1 Implement `User`, `Post`, and `Comment` entities with required/optional fields and relationships.
- [x] 2.2 Configure EF Core model constraints for unique `Email` and unique `PhoneNumber`.
- [x] 2.3 Create initial EF Core migration for users/posts/comments schema.
- [x] 2.4 Add startup migration execution strategy for development mode.
- [x] 2.5 Export and maintain DB delivery scripts (`DB/schema.sql`, optional `DB/migration.sql`).
- [x] 2.6 Add soft delete fields and default query filters for posts/comments (`IsDeleted == false` on read paths).

## 3. Stored Procedures and Repository Access

- [x] 3.1 Define and version stored procedures for user create, user lookup by phone, post create, comment create, and required query/update operations.
- [x] 3.2 Implement repository methods that call stored procedures or parameterized SQL only.
- [x] 3.3 Validate no SQL string concatenation paths exist in repository data access code.

## 4. Authentication and Authorization

- [x] 4.1 Implement registration flow with duplicate checks for phone/email and password hashing.
- [x] 4.2 Implement login flow with phone lookup, password verification, and cookie sign-in.
- [x] 4.3 Configure authentication cookie options (`HttpOnly`, `SameSite`, `Secure` by environment).
- [x] 4.4 Protect post/comment write actions with `[Authorize]`.
- [x] 4.5 Enforce ownership check (`Post.UserId == CurrentUserId`) in service layer for post edit/delete.

## 5. Post and Comment Features

- [x] 5.1 Implement post create flow (content required, image optional).
- [x] 5.2 Implement post edit flow for owner only.
- [x] 5.3 Implement post delete flow for owner only.
- [x] 5.4 Implement comment create flow with target post existence validation.

## 6. Security Baseline Controls

- [x] 6.1 Add anti-forgery tokens to all POST forms and validate with `[ValidateAntiForgeryToken]`.
- [x] 6.2 Use ViewModels for form binding and add validation attributes/length limits for auth/post/comment inputs.
- [x] 6.3 Ensure user-generated content rendering uses default Razor encoding (no unsafe raw rendering).
- [x] 6.4 Add basic login retry guard strategy (MVP level) or explicit feature flag/defer marker.

## 7. Transactions and Consistency

- [x] 7.1 Implement explicit transaction for multi-step/multi-table write flows (e.g., post delete with related updates).
- [x] 7.2 Add rollback handling and error propagation for transactional failures.
- [x] 7.3 Add repository/service tests covering atomic commit and rollback behavior.

## 8. MVC UI and User Flows

- [x] 8.1 Create Razor views for register, login, posts index/create/edit, and comment entry.
- [x] 8.2 Wire controllers to services for full Register/Login/Create Post/Add Comment/Edit/Delete flows.
- [x] 8.3 Add user-facing validation/error messages for common failure cases (duplicate account, unauthorized operation, missing post).
- [x] 8.4 Apply Bootstrap responsive layout rules and verify mobile usability for core pages.

## 9. Containerization and Reverse Proxy

- [x] 9.1 Create/update `Dockerfile` to restore, publish, and run app on port 8080.
- [x] 9.2 Create/update `docker-compose.yml` with `nginx`, `app`, and `db` services, using SQL Server as default database target.
- [x] 9.3 Add `nginx/default.conf` reverse proxy settings and forwarded headers support in app startup.
- [x] 9.4 Add container health checks and startup gating/retry so app waits for database readiness.

## 10. Verification and Delivery

- [x] 10.1 Execute smoke tests for register/login/create post/comment/edit/delete with authorization checks.
- [x] 10.2 Run migration and deployment verification in Docker environment.
- [x] 10.3 Cross-check implementation against all spec files and close any uncovered requirements.
- [x] 10.4 Update docs for setup, migration workflow, and operational rollback notes.
- [x] 10.5 Add and maintain `DB/README.md` describing schema/SP/seed/sample-data usage and update workflow.
