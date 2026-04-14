# Index Contribution Worker 启动指南

## 前置条件

1. ✅ PostgreSQL 数据库运行中
2. ✅ Redis 运行中
3. ✅ Spot ingestion 数据流存在（`dev:stream:spot`）

## 步骤 1：添加环境变量到 `.env`

在项目根目录的 `.env` 文件中添加以下配置：

```bash
# Index Contribution Worker Configuration
INDEX_CONTRIBUTION_ENABLED=true
INDEX_CONTRIBUTION_ENV=dev
INDEX_CONTRIBUTION_GROUP=index-contrib:spot
INDEX_CONTRIBUTION_CONSUMER=index-contrib-1
INDEX_CONTRIBUTION_STREAM_KEY=dev:stream:spot
INDEX_CONTRIBUTION_READ_COUNT=200
INDEX_CONTRIBUTION_BLOCK_MS=1000
INDEX_CONTRIBUTION_CLAIM_IDLE_MS=30000
INDEX_CONTRIBUTION_CLAIM_COUNT=200
INDEX_CONTRIBUTION_CODE=TSE001
INDEX_CONTRIBUTION_WEIGHTS_FILE=infra/config/tse001_weights.json
INDEX_CONTRIBUTION_SECTOR_MAPPING_FILE=infra/config/tse001_sector_mapping.json
INDEX_CONTRIBUTION_INDEX_PREV_CLOSE=23000
INDEX_CONTRIBUTION_REDIS_MAX_RETRIES=3
INDEX_CONTRIBUTION_REDIS_RETRY_BACKOFF_MS=100
INDEX_CONTRIBUTION_REDIS_TTL_SECONDS=86400
INDEX_CONTRIBUTION_DB_MAX_RETRIES=3
INDEX_CONTRIBUTION_DB_RETRY_BACKOFF_MS=100
INDEX_CONTRIBUTION_ALARM_THRESHOLD_REDIS=5
INDEX_CONTRIBUTION_ALARM_THRESHOLD_DB=5
```

### 关键配置说明

- `INDEX_CONTRIBUTION_ENABLED=true` - 启用 worker
- `INDEX_CONTRIBUTION_STREAM_KEY=dev:stream:spot` - 消费的 Redis Stream key
- `INDEX_CONTRIBUTION_CODE=TSE001` - 计算的指数代码
- `INDEX_CONTRIBUTION_INDEX_PREV_CLOSE=23000` - 指数前一日收盘价（需要根据实际调整）
- `INDEX_CONTRIBUTION_WEIGHTS_FILE` - 成分股权重配置文件
- `INDEX_CONTRIBUTION_SECTOR_MAPPING_FILE` - 产业分类映射文件

## 步骤 2：检查配置文件

确认以下文件存在：

```bash
# 成分股权重配置
infra/config/tse001_weights.json

# 产业分类映射
infra/config/tse001_sector_mapping.json

# 股票清单（Spot ingestion 使用）
infra/config/stock150.txt
```

### 查看权重文件格式

```bash
cat infra/config/tse001_weights.json
```

预期格式：
```json
{
  "2330": {
    "symbol": "2330",
    "symbol_name": "台積電",
    "weight": 0.345,
    "sector": "semiconductor"
  },
  "2454": {
    "symbol": "2454",
    "symbol_name": "聯發科",
    "weight": 0.052,
    "sector": "semiconductor"
  }
}
```

### 查看产业映射格式

```bash
cat infra/config/tse001_sector_mapping.json
```

预期格式：
```json
{
  "2330": "semiconductor",
  "2454": "semiconductor",
  "2881": "financial",
  "2882": "financial"
}
```

## 步骤 3：数据库迁移（如果需要）

Worker 需要以下三张表：

1. `index_contribution_snapshot_1m`
2. `index_contribution_ranking_1m`
3. `sector_contribution_snapshot_1m`

检查表是否存在：

```bash
cd apps/backend
python -c "from app.db.engine import get_db_engine; engine = get_db_engine(); print([t for t in engine.table_names() if 'index_contribution' in t or 'sector_contribution' in t])"
```

如果表不存在，运行迁移：

```bash
cd apps/backend
alembic upgrade head
```

## 步骤 4：确认上游数据源

Index Contribution Worker 需要从 Spot Stream 消费数据。确认 spot ingestion 正在运行：

```bash
# 检查 Redis Stream 是否存在
redis-cli XINFO STREAM dev:stream:spot

# 查看最新几笔数据
redis-cli XREVRANGE dev:stream:spot + - COUNT 5
```

如果 stream 不存在，需要先启动 spot ingestion worker。

## 步骤 5：启动 Index Contribution Worker

```bash
cd apps/backend
python -m workers.index_contribution_worker
```

### 预期日志输出

```
INFO:app.stream_processing.worker_runtime:IndexContributionRunner initialized
INFO:app.index_contribution.runner:Loading constituents from infra/config/tse001_weights.json
INFO:app.index_contribution.runner:Loaded 150 constituents for TSE001
INFO:app.stream_processing.worker_runtime:Starting worker runtime
INFO:app.index_contribution.runner:Processing spot update: symbol=2330, last_price=950.0
INFO:app.index_contribution.runner:Published ranking: top=20, bottom=20
INFO:app.index_contribution.runner:Published sector aggregate: 4 sectors
```

## 步骤 6：验证 Redis 数据

Worker 运行后，检查 Redis 是否有数据：

```bash
# 检查 ranking (top contributors)
redis-cli ZREVRANGE dev:state:index_contrib:TSE001:2026-04-14:ranking:top 0 4 WITHSCORES

# 检查 sector treemap 数据
redis-cli GET dev:state:index_contrib:TSE001:2026-04-14:sector

# 检查个股最新数据
redis-cli GET dev:state:index_contrib:TSE001:2026-04-14:2330:latest
```

## 步骤 7：验证 SSE 推送

启动 backend server：

```bash
cd apps/backend
uvicorn app.main:app --reload
```

在浏览器中打开 Treemap Demo 页面：
```
http://localhost:5173/treemap-demo
```

预期看到：
- ✅ Treemap 显示各产业和股票
- ✅ 贡献点数根据正负值显示颜色（正=红，负=绿）
- ✅ 右边 Top/Bottom Contributors 显示排名

## 常见问题

### Q1: Worker 启动后没有数据

**原因**：可能 spot stream 没有数据

**解决**：
1. 检查 spot ingestion worker 是否运行
2. 确认 `INGESTOR_MARKET_ENABLED=true` 和 `INGESTOR_SPOT_SYMBOLS_FILE` 设置正确
3. 查看 Redis stream 是否有数据：`redis-cli XLEN dev:stream:spot`

### Q2: 找不到权重文件

**错误**：`FileNotFoundError: infra/config/tse001_weights.json`

**解决**：
1. 确认文件路径正确（相对于项目根目录）
2. 检查文件格式是否正确
3. 确认 `.env` 中的 `INDEX_CONTRIBUTION_WEIGHTS_FILE` 设置正确

### Q3: Treemap 显示 mock 数据

**原因**：SSE 没有推送实时数据

**检查**：
1. Backend server 是否运行
2. Frontend 是否连接到 SSE：打开浏览器 Console，查找 "SSE connected" 日志
3. 检查 Redis 是否有数据（步骤 6）

### Q4: INDEX_CONTRIBUTION_INDEX_PREV_CLOSE 设置多少？

**说明**：这是加权指数的前一日收盘价，用于计算贡献点数。

**TSE001 (台湾加权指数) 示例**：
- 如果昨日收盘是 23,000 点，设置 `INDEX_CONTRIBUTION_INDEX_PREV_CLOSE=23000`
- 可以从 Yahoo Finance 或其他数据源查询最新收盘价

## 完整启动流程（从零开始）

```bash
# 1. 启动基础服务
docker-compose up -d postgres redis

# 2. 确认配置文件
ls infra/config/tse001_*.json
ls infra/config/stock150.txt

# 3. 数据库迁移
cd apps/backend
alembic upgrade head

# 4. 启动 spot ingestion（提供上游数据）
python -m app.market_ingestion

# 5. 启动 index contribution worker
python -m workers.index_contribution_worker

# 6. 启动 backend API server
uvicorn app.main:app --reload

# 7. 启动 frontend
cd ../frontend
npm run dev

# 8. 打开浏览器访问
# http://localhost:5173/treemap-demo
```

## 监控与调试

### 查看 Worker Metrics

Worker 会发送 metrics，可以查看：
- `index_contribution_events_processed_total` - 处理的事件数
- `index_contribution_redis_ranking_write_total` - Redis 写入次数
- `index_contribution_db_flush_total` - 数据库 flush 次数
- `index_contribution_redis_errors_total` - Redis 错误数

### 日志级别

在 `.env` 添加：
```bash
LOG_LEVEL=DEBUG
```

重启 worker 查看详细日志。
