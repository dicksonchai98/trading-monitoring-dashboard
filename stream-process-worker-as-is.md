# Stream Process Worker 现况整理（As-Is）

> 基于当前代码（`apps/backend`）整理，重点拆成 `data ingest`、`stream process`、`data serving` 三段。

## 0. Worker 进程角色（当前部署形态）

`docker-compose.yml` 目前有这几种相关进程：

- `backend-api`：仅提供 HTTP API（显式设定 `AGGREGATOR_ENABLED: "false"`）
- `backend-stream-worker`：兼容旧模式，跑 `python -m workers.stream_processing_worker`（tick+bidask 同进程）
- `backend-tick-worker`：跑 `python -m workers.stream_processing_tick_worker`
- `backend-bidask-worker`：跑 `python -m workers.stream_processing_bidask_worker`
- `backend-latest-state-worker`：跑 `python -m workers.latest_state_worker`（spot latest state）

`stream process worker` 本体由：

- 入口：`workers/stream_processing_worker.py`（以及 tick/bidask 分离入口）
- 运行时：`app/stream_processing/worker_runtime.py`
- 业务逻辑：`app/stream_processing/runner.py`

---

## 1. Data Ingest（Shioaji -> Redis Streams）

实现位置：`app/market_ingestion/*`

### 1.1 Ingest 流程

1. `MarketIngestionRunner` 注册 Shioaji callback（futures tick / futures bidask / spot tick）
2. callback 组装 `IngestionEvent`
3. 进内存队列（`IngestionPipeline.queue`）
4. `RedisWriter` 异步写入 Redis Stream（`XADD`，带 `MAXLEN ~`）

### 1.2 Event Schema

`IngestionEvent`（`app/market_ingestion/contracts.py`）字段：

- `source`
- `code`
- `asset_type`
- `quote_type`
- `event_ts`
- `recv_ts`
- `ingest_seq`（spot 才会带）
- `payload`（原始 quote 衍生）

实际写入 Redis 时：

- futures (`asset_type=futures`)：
  - `source`, `code`, `quote_type`, `event_ts`, `recv_ts`, `payload`, `asset_type`
- spot (`asset_type=spot`)：
  - `source`, `symbol`, `event_ts`, `last_price`, `ingest_seq`, `recv_ts`, `payload`, `asset_type`

### 1.3 Redis Key（Ingest 阶段）

Stream key 规则（`build_stream_key`）：

- `{env}:stream:{quote_type}:{code}`

典型示例：

- `dev:stream:tick:TXFC6`
- `dev:stream:bidask:TXFC6`
- `dev:stream:spot:2330`

### 1.4 技术细节

- 写入策略：`XADD ... MAXLEN ~ {INGESTOR_STREAM_MAXLEN}`（近似裁剪）
- 重试：`INGESTOR_REDIS_RETRY_ATTEMPTS` + `INGESTOR_REDIS_RETRY_BACKOFF_MS`
- queue 满时丢弃并打指标（`events_dropped_total`）
- reconnect/resubscribe 由 runner 内部任务处理（指数退避上限 `INGESTOR_RECONNECT_MAX_SECONDS`）

---

## 2. Stream Process（Redis Streams -> Redis State + PostgreSQL）

实现位置：`app/stream_processing/runner.py`

### 2.1 消费与 ACK 机制

- 每条管线都用 consumer group：
  - tick: `AGGREGATOR_TICK_GROUP`（默认 `agg:tick`）
  - bidask: `AGGREGATOR_BIDASK_GROUP`（默认 `agg:bidask`）
- 读法：先 `XAUTOCLAIM`（捞 pending），再 `XREADGROUP`（读新消息）
- 只有 handler 成功（返回 `True`）才会 `XACK`
- stream 自动发现模式：
  - tick 扫描 `{env}:stream:tick:*`
  - bidask 扫描 `{env}:stream:bidask:*`

### 2.2 Tick 管线做什么

- 输入：futures tick stream
- 状态机：`TickStateMachine`
  - 聚合当前 1 分钟 K
  - 跨分钟时产出 archived K
- Redis 写入：
  - 当前 K：`{env}:state:{code}:{trade_date}:k:current`（Hash）
  - 今日 K 序列：`{env}:state:{code}:{trade_date}:k:zset`（ZSET，score=秒级时间戳）
- DB 落盘：archived K 入异步 queue，再批次写 `kbars_1m`

### 2.3 BidAsk 管线做什么

- 输入：futures bidask stream
- 状态机：`BidAskStateMachine`
  - 更新 latest 指标：`bid/ask/mid/spread/bid_size/ask_size`
  - 按秒采样（支持 carry-forward）
  - `delta_1s` 根据 `AGGREGATOR_SERIES_FIELDS` 计算
- Redis 写入：
  - latest：`{env}:state:{code}:{trade_date}:metrics:latest`（String JSON）
  - 序列：`{env}:state:{code}:{trade_date}:metrics:zset`（ZSET，score=秒）
- DB 落盘：批次写 `bidask_metrics_1s`

### 2.4 DB Sink 细节（两条管线共通）

- 内部异步批次队列（tick / bidask 各一条）
- 批次大小：`AGGREGATOR_DB_SINK_BATCH_SIZE`
- 重试：`AGGREGATOR_DB_SINK_MAX_RETRIES` + `AGGREGATOR_DB_SINK_RETRY_BACKOFF_SECONDS`
- 超过重试后写 dead-letter stream：
  - `{env}:stream:dead-letter:tick`
  - `{env}:stream:dead-letter:bidask`

### 2.5 DB Table / Schema（stream process 会写）

1. `kbars_1m`

- 主字段：`code`, `trade_date`, `minute_ts`, `open`, `high`, `low`, `close`, `volume`
- 约束：`uq_kbars_1m_code_minute_ts`（`code + minute_ts`）
- 索引：`code`, `trade_date`, `minute_ts`, `(code, trade_date)`

2. `bidask_metrics_1s`

- 主字段：`code`, `trade_date`, `event_ts`, `bid`, `ask`, `spread`, `mid`, `bid_size`, `ask_size`, `metric_payload`
- 约束：`uq_bidask_metrics_1s_code_event_ts`（`code + event_ts`）
- 索引：`code`, `trade_date`, `event_ts`, `(code, trade_date)`

---

## 3. Data Serving（Redis/DB -> REST + SSE）

实现位置：`app/routes/serving.py` + `app/services/serving_store.py`

### 3.1 Serving 读路径

- 实时/当日优先读 Redis state
- 历史区间读 PostgreSQL（`kbars_1m`）
- `/v1/kbar/1m/range` 会 merge DB history + Redis today

### 3.2 REST API（关键）

- `GET /v1/kbar/1m/current` -> Redis `...:k:current`
- `GET /v1/kbar/1m/today` -> Redis `...:k:zset`
- `GET /v1/kbar/1m/history` -> DB `kbars_1m`
- `GET /v1/kbar/1m/range` -> DB+Redis merge
- `GET /v1/metric/bidask/latest` -> Redis `...:metrics:latest`
- `GET /v1/metric/bidask/today` -> Redis `...:metrics:zset`

### 3.3 SSE API

- `GET /v1/stream/sse`
- 轮询周期：`SERVING_POLL_INTERVAL_MS`（默认 1000ms）
- 每轮读取：`fetch_current_kbar` + `fetch_metric_latest`
- 仅在数据变化时推送：
  - `event: kbar_current`
  - `event: metric_latest`
- 心跳：`event: heartbeat`（`SERVING_HEARTBEAT_SECONDS`，默认 15s）

### 3.4 认证与限流

- REST/SSE 都要求 `require_authenticated`
- 速率与连接限制在 `deps.py`：
  - `SERVING_RATE_LIMIT_PER_MIN`
  - `SERVING_SSE_CONN_LIMIT`

---

## 4. 补充：Spot Latest State Worker（与 stream process 并行）

实现位置：`app/latest_state/runner.py`

- 消费 `{env}:stream:spot:*`（group 默认 `latest-state:spot`）
- 根据 `ingest_seq` 去重/乱序保护
- 维护 symbol 最新状态并 flush 到：
  - `{env}:state:spot:{symbol}:latest`（String JSON）
- 字段含：`last_price`, `session_high`, `session_low`, `is_new_high`, `is_new_low`, `updated_at`

---

## 5. 一句话结论（现在这个 stream process worker 在干嘛）

当前它的职责是：**从 Redis Stream 消费 futures tick/bidask，做分钟 K 与秒级 bidask 指标聚合，实时写 Redis 状态供 API/SSE 读取，并异步批量落盘到 PostgreSQL，失败批次进 dead-letter stream。**
