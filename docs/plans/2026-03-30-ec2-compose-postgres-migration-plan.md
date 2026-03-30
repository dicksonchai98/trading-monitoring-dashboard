# EC2 Compose Postgres Migration Plan

Date: 2026-03-30  
Scope: EC2 deployment only (`docker-compose.ec2.yml` + `.env.production`)

## Goal

- Run PostgreSQL inside the EC2 docker compose stack.
- Ensure backend API/workers start only after DB is healthy.
- Execute Alembic migrations safely before serving traffic.

## Deployment Sequence

1. Prepare environment file on EC2
- Copy `.env.production.example` to `.env.production`.
- Fill secrets, especially:
  - `POSTGRES_PASSWORD`
  - `DATABASE_URL_DOCKER`
  - JWT/Stripe/SendGrid/Shioaji keys

2. Start stateful dependencies first
- Command:
```bash
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d postgres redis
```

3. Run database migration (one-off)
- Command:
```bash
docker compose -f docker-compose.yml -f docker-compose.ec2.yml run --rm backend-api alembic -c alembic.ini upgrade head
```

4. Start application services
- Command:
```bash
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d backend-api backend-stream-worker backend-email-worker frontend-web nginx
```

5. Verify
- Check container status:
```bash
docker compose -f docker-compose.yml -f docker-compose.ec2.yml ps
```
- Check backend logs:
```bash
docker compose -f docker-compose.yml -f docker-compose.ec2.yml logs --tail=200 backend-api
```

## Rollback Plan

1. Stop app services only:
```bash
docker compose -f docker-compose.yml -f docker-compose.ec2.yml stop nginx frontend-web backend-api backend-stream-worker backend-email-worker
```

2. Restore DB from backup/snapshot if migration introduced breaking schema changes.

3. Re-run stack with previous known-good image/env.

## Notes

- `postgres_data` is persisted docker volume; container recreation will not drop DB.
- For production-grade HA/backup/compliance, migrate from compose Postgres to managed RDS in a later phase.
