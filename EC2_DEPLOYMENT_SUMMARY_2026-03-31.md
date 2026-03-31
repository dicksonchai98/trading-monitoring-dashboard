# EC2 Deployment Summary (2026-03-31)

## 1. 背景与目标

目标是将专案部署到 AWS EC2，并满足：

- 前端可通过 `market-micro.com` 访问
- 后端 API / SSE 正常
- PostgreSQL、Redis、Email Worker 可运行
- Cloudflare 代理与 SSL 可用
- 不影响本地开发 `docker-compose.yml`

---

## 2. 关键问题与处理记录

## 问题 A: EC2 部署配置与本地配置混用风险

### 现象
- 希望新增线上配置但不影响本地。

### 处理
- 新增独立的 EC2 override 配置，不改本地基础 compose。
- 使用 `docker-compose.ec2.yml` + `.env.production`。

### 关键指令
```bash
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d
```

---

## 问题 B: `docker-compose v1` 出现 `ContainerConfig` 错误

### 现象
- 多次出现：
  - `KeyError: 'ContainerConfig'`
  - 容器重建失败

### 原因
- 旧版 `docker-compose` 与当前 Docker Engine 兼容问题 + 残留容器状态冲突。

### 处理
- 切到 `docker compose` (v2) 指令。
- 清理残留容器与网络后重建。

### 关键指令
```bash
docker ps -a --format '{{.Names}}' | grep 'trading-monitoring-dashboard' | xargs -r docker rm -f
docker network prune -f
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml up -d postgres redis
```

---

## 问题 C: Nginx 启动报 `cat: can't open 'server'`

### 现象
- Nginx 日志出现：
  - `cat: can't open 'server'`
  - `cat: can't open '{'`

### 原因
- 使用 heredoc 动态写 Nginx 配置，在该环境下解析失败。

### 处理
- 改为固定配置文件挂载：
  - `infra/nginx.ec2.conf`
  - 不再用 `command` heredoc。

### 关键指令
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml up -d --no-deps --force-recreate nginx
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml logs --tail=100 nginx
```

---

## 问题 D: YAML 解析错误 (`ParserError`)

### 现象
- `expected <block end>, but found <block mapping start>`

### 原因
- `docker-compose.ec2.yml` 缩排损坏（services 层级错位）。

### 处理
- 重整整个 `docker-compose.ec2.yml`，确保服务缩排统一。

### 验证指令
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml config
```

---

## 问题 E: 前端静态档挂载后页面 403 / 500

### 现象
- 403 Forbidden
- Nginx 报 `rewrite or internal redirection cycle`
- 容器内 `/usr/share/nginx/html` 为空

### 原因
1. `FRONTEND_DIST_DIR` 设错（`/home/ec2-user/...`，实际在 `/home/ubuntu/...`）。
2. 静态目录权限太严（`drwx------`）。

### 处理
- 修正 `.env.production`：
  - `FRONTEND_DIST_DIR=/home/ubuntu/trading-monitoring-dashboard/apps/frontend/dist`
- 重新挂载并重建 nginx。
- 修正 dist 目录权限。

### 关键指令
```bash
sed -i 's#^FRONTEND_DIST_DIR=.*#FRONTEND_DIST_DIR=/home/ubuntu/trading-monitoring-dashboard/apps/frontend/dist#' .env.production

docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml up -d --no-deps --force-recreate nginx

docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml exec nginx ls -la /usr/share/nginx/html
```

```bash
chmod 755 /home/ubuntu/trading-monitoring-dashboard/apps/frontend/dist
chmod 755 /home/ubuntu/trading-monitoring-dashboard/apps/frontend/dist/assets
chmod 644 /home/ubuntu/trading-monitoring-dashboard/apps/frontend/dist/index.html
find /home/ubuntu/trading-monitoring-dashboard/apps/frontend/dist/assets -type f -exec chmod 644 {} \;
```

---

## 问题 F: Cloudflare HTTPS 521

### 现象
- `http` 301，`https` 521

### 原因
- Cloudflare 到源站 443 不通（未完整配置 TLS / 443）。

### 处理
- 配置 Nginx 443 与 Cloudflare Origin Certificate：
  - `infra/certs/origin.crt`
  - `infra/certs/origin.key`
- `docker-compose.ec2.yml` 开放 `443:443` 并挂载证书目录。
- `infra/nginx.ec2.conf` 改为：
  - 80 跳转 443（保留 `/healthz`）
  - 443 提供静态与 API/SSE 反代。
- Cloudflare SSL 模式使用 `Full (strict)`。

### 关键指令
```bash
mkdir -p infra/certs
# 将 Cloudflare Origin CRT/KEY 写入 infra/certs/origin.crt 与 infra/certs/origin.key
chmod 644 infra/certs/origin.crt
chmod 600 infra/certs/origin.key

docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml up -d --no-deps --force-recreate nginx
```

---

## 问题 G: 前端调用 `/api/...` 返回 404

### 现象
- 前端用 `/api/auth/email/send-otp`，后端实际路由是 `/auth/...`。

### 处理
- 在 `infra/nginx.ec2.conf` 加 `/api/` rewrite：
  - `/api/auth/...` -> `/auth/...`

### 关键配置逻辑
```nginx
location ^~ /api/ {
  rewrite ^/api/(.*)$ /$1 break;
  proxy_pass http://backend-api:8000;
}
```

---

## 问题 H: OTP API 500（数据库认证失败）

### 现象
- `sqlalchemy.exc.OperationalError`
- `FATAL: password authentication failed for user "postgres"`

### 原因
- `POSTGRES_PASSWORD` 与 `DATABASE_URL_DOCKER` 中密码不一致，或旧 DB 初始化密码与当前 env 不一致。

### 处理
- 统一 `.env.production` 中 DB 密码设置。
- 重建 DB（测试环境）并重新 migration。

### 关键指令
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml down -v
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml up -d postgres redis
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml run --rm backend-api alembic -c alembic.ini upgrade head
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml up -d backend-api nginx backend-email-worker
```

---

## 3. 当前部署形态（最终）

- 前端：静态档 (`apps/frontend/dist`) 由 Nginx 直接提供
- API：FastAPI (`backend-api`)
- DB：compose 内 Postgres
- Cache/Queue：Redis
- SSL：Cloudflare Origin Certificate + Nginx 443
- Cloudflare：`Full (strict)`

---

## 4. 常用运维命令

### 查看服务状态
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml ps
```

### 查看日志
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml logs --tail=200 nginx
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml logs --tail=200 backend-api
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml logs --tail=200 backend-email-worker
```

### 重建单个服务（不拉依赖）
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.ec2.yml up -d --no-deps --force-recreate nginx
```

### 验证健康
```bash
curl -I http://127.0.0.1/healthz
curl -kI --resolve market-micro.com:443:<EIP> https://market-micro.com/healthz
```

---

## 5. 本次经验总结

1. 线上配置必须和本地配置完全分离（`docker-compose.ec2.yml` + `.env.production`）。
2. EC2 + Cloudflare 的问题要分层排查：源站（EIP）-> Cloudflare -> DNS/SSL。
3. 静态站挂载路径和权限是最常见 403/500 根因。
4. DB 连线错误优先检查：`DATABASE_URL_DOCKER` 与 `POSTGRES_PASSWORD` 一致性。
5. 在低规格实例（如 `t3.micro`）避免在线 build 前端，改本地/CI build 后上传 `dist`。
