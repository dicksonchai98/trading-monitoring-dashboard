# DB Scripts

- `schema.sql`: table/index/constraint DDL.
- `stored-procedures.sql`: stored procedures used by repositories.
- `seed.sql`: baseline initial user data.
- `sample-data.sql`: demo data for local testing.

## Update workflow

1. Update EF model and generate migration:
   - `dotnet dotnet-ef migrations add <Name> --project SocialMediaApp.Web/SocialMediaApp.Web.csproj --startup-project SocialMediaApp.Web/SocialMediaApp.Web.csproj`
2. Update `schema.sql` and `stored-procedures.sql` if schema or SP contract changed.
3. Re-test register/login/post/comment flows.

## Run order in fresh database

1. `schema.sql`
2. `stored-procedures.sql`
3. `seed.sql`
4. `sample-data.sql`
