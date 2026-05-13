# Social Media MVC Implementation Runbook (2026-05-12)

## Setup

1. Restore and run tests:
   - `dotnet test SocialMediaApp.slnx`
2. Apply EF migration to local database:
   - `dotnet dotnet-ef database update --project SocialMediaApp.Web/SocialMediaApp.Web.csproj --startup-project SocialMediaApp.Web/SocialMediaApp.Web.csproj`
3. Ensure stored procedures exist in DB:
   - Run `SocialMediaApp.Web/DB/stored-procedures.sql`
4. Start app:
   - `dotnet run --project SocialMediaApp.Web/SocialMediaApp.Web.csproj`

## Migration Workflow

1. Modify entities/model config.
2. Create migration:
   - `dotnet dotnet-ef migrations add <MigrationName> --project SocialMediaApp.Web/SocialMediaApp.Web.csproj --startup-project SocialMediaApp.Web/SocialMediaApp.Web.csproj`
3. Generate SQL delivery script:
   - `dotnet dotnet-ef migrations script --project SocialMediaApp.Web/SocialMediaApp.Web.csproj --startup-project SocialMediaApp.Web/SocialMediaApp.Web.csproj -o SocialMediaApp.Web/DB/migration.sql`
4. Update `DB/schema.sql` and `DB/stored-procedures.sql` if contract changed.

## Rollback

- Remove last unapplied migration:
  - `dotnet dotnet-ef migrations remove --project SocialMediaApp.Web/SocialMediaApp.Web.csproj --startup-project SocialMediaApp.Web/SocialMediaApp.Web.csproj`
- Roll back database to previous migration:
  - `dotnet dotnet-ef database update <PreviousMigration> --project SocialMediaApp.Web/SocialMediaApp.Web.csproj --startup-project SocialMediaApp.Web/SocialMediaApp.Web.csproj`

## Docker Verification Notes

- `docker compose config` passes with health checks and dependency gating.
- `docker compose build app` currently cannot run in this environment because Docker daemon is not running (`dockerDesktopLinuxEngine` pipe unavailable).
