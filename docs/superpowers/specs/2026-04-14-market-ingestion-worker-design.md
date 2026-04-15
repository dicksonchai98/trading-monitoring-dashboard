# Market Ingestion 独立 Worker 设计

## 1. 背景与目标

当前 `MarketIngestionRunner` 在 `backend-api` 进程 startup 中启动，导致 API 与 ingestion 共享同一事件循环与进程资源。目标是将 market ingestion 迁移为独立 worker，降低高吞吐行情接入对 Web API 延迟与稳定性的影响。

本设计以本地/开发 `docker-compose.yml` 为主，采用一次切换策略，不保留 API 内嵌 ingestion 运行路径。

## 2. 范围

### In Scope

- 新增独立 ingestion worker 入口与进程运行方式。
- 在 `docker-compose.yml` 中新增默认启动的 `backend-ingestor-worker` 服务。
- 移除或禁用 `backend-api` 中 ingestion startup 路径。
- 保持既有 ingestion 数据协议与下游消费路径不变。
- 补充对应运维文档与启动说明。

### Out of Scope

- ingestion 业务逻辑重写（callback、pipeline、writer 语义不变）。
- Redis stream key 格式变更。
- 下游 stream processing/latest-state/summary worker 协议调整。
- 本次不先处理 EC2 compose 实施，仅在后续同步。

## 3. 方案概览（已选）

采用方案 A：新增独立 `backend-ingestor-worker`，并将 ingestion 从 `backend-api` 完全剥离。

理由：

- 满足 API 稳定性优先目标，隔离最彻底。
- 运行模型与现有其他 worker（stream/latest-state 等）一致，维护成本低。
- 避免双入口并存导致的配置歧义与排障复杂度。

## 4. 目标架构

### 4.1 进程职责

- `backend-api`：仅承载 HTTP API、认证、SSE 服务端读取等 Web 职责；不启动 ingestion runner。
- `backend-ingestor-worker`：专职运行 `MarketIngestionRunner`，负责 Shioaji 登录、订阅、重连、写入 Redis Streams。
- 现有下游 worker：继续消费 Redis Streams，不感知本次变更。

### 4.2 数据流

数据流保持不变：

`Shioaji -> app.market_ingestion (pipeline/writer) -> Redis Streams -> downstream workers`

## 5. 组件设计

### 5.1 新增 ingestion worker entrypoint

新增 worker 入口（建议命名：`workers/ingestor_worker.py`）：

- 构建 `state.build_ingestor_runner()`。
- 启动 `runner.start()`。
- 处理 `SIGINT/SIGTERM`，优雅调用 `runner.stop()`。
- 输出与现有 worker 一致的生命周期日志。

### 5.2 API startup 改造

`app.main` 中：

- 删除或禁用 `INGESTOR_ENABLED` 分支下的 `state.build_ingestor_runner()` 启动逻辑。
- 避免 `backend-api` shutdown 期望持有 `state.ingestor_runner` 的强耦合路径。

### 5.3 Compose 改造（本地）

`docker-compose.yml`：

- 新增 `backend-ingestor-worker` 服务（同 backend 镜像与 env 文件）。
- command 指向 ingestion worker entrypoint。
- 默认参与 `docker compose up` 启动（不放 profile）。

## 6. 配置与运维约定

- 保留既有 ingestion 配置键（`INGESTOR_*`, `SHIOAJI_*`, `REDIS_URL`）。
- `INGESTOR_ENABLED` 语义收敛为“ingestor worker 是否启用 ingestion”；API 不再消费该开关进行启动控制。
- 运维检查重点转为 worker 进程健康、Redis stream 写入速率与滞后指标。

## 7. 错误处理与可靠性

- 沿用现有 `MarketIngestionRunner` reconnect/backoff 策略。
- 沿用 queue overflow drop 与相关 metrics，不改变 drop policy。
- worker 异常退出通过容器重启策略恢复（compose restart policy）。
- API 进程不再承载 ingestion 阻塞风险，故 API 事件循环压力显著下降。

## 8. 测试与验收

### 8.1 测试

- 新增 ingestion worker entrypoint 单元测试（启动/停止、信号处理、异常传播）。
- 组合验证：`docker compose up` 后确认
  - `backend-ingestor-worker` 正常运行；
  - Redis stream 持续写入；
  - `backend-api` 核心接口可用。

### 8.2 验收标准

- 功能等价：ingestion 事件持续进入既有 Redis Streams，下游消费正常。
- 运行隔离：停止/重启 ingestion worker 不应导致 API 进程重启或 API 主路径不可用。
- 稳定性目标：高行情输入下，API 的超时与长尾延迟相比迁移前下降或至少不劣化。

## 9. 迁移步骤（一次切换）

1. 增加 ingestion worker entrypoint。
2. 改造 `app.main`，移除 API 内嵌 ingestion 启动。
3. 更新 `docker-compose.yml` 新增 `backend-ingestor-worker` 默认启动。
4. 运行本地组合验证并记录观察项。
5. 更新 runbook 与部署说明。

## 10. 风险与缓解

- 风险：worker 未启动导致全链路无新行情。
  - 缓解：将 ingestor 设为 compose 默认服务，并监控关键指标与日志。
- 风险：配置迁移期间 `INGESTOR_ENABLED` 语义混乱。
  - 缓解：文档明确“API 不消费该开关”并统一模板配置说明。
- 风险：一次切换回退窗口短。
  - 缓解：保留变更前 compose 版本与快速回滚步骤（恢复 API startup ingestion 路径）。
