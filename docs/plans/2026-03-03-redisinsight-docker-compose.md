# Redis + RedisInsight Compose Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Redis and RedisInsight to the Docker Compose stack and ensure Python requirements include Redis.

**Architecture:** Compose provides two new services: `redis` for data storage and `redisinsight` for UI management. RedisInsight connects to Redis via the Compose service name on the default network. Redis data persists in a named volume.

**Tech Stack:** Docker Compose, Redis, RedisInsight, Python requirements

---

### Task 1: Add Redis + RedisInsight to Docker Compose

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Edit compose to add services and volume**

Update `docker-compose.yml` to include:
- `redis` service (image `redis:7-alpine`, port `6379:6379`)
- `redisinsight` service (image `redis/redisinsight:latest`, port `5540:5540`, depends on `redis`)
- `volumes: redis_data` for Redis persistence

**Step 2: Validate compose syntax**

Run: `docker compose config`
Expected: command succeeds and prints the composed configuration

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "infra: add redis and redisinsight compose services"
```

### Task 2: Ensure Python requirements include Redis

**Files:**
- Modify (if missing): `apps/backend/requirements.txt`

**Step 1: Verify requirement**

Run: `rg "^redis" apps/backend/requirements.txt`
Expected: a line like `redis>=5.0.0`

**Step 2: Add requirement if missing**

Append `redis>=5.0.0` if not present.

**Step 3: Commit**

```bash
git add apps/backend/requirements.txt
git commit -m "build: ensure redis dependency"
```
