# Stream Process Current Summary

## 1. 目前 Stream Process 服务在做什么

### 1.1 进程与入口
- 独立 worker 入口：`python -m workers.stream_processing_worker`
- 入口文件：`apps/backend/workers/stream_processing_worker.py`
- runtime 包装器：`apps/backend/app/stream_processing/worker_runtime.py`
- 核心处理器：`apps/backend/app/stream_processing/runner.py`

### 1.2 启动与生命周期
- worker 启动后会建立 `StreamProcessingRunner`，并进入 `run_forever()` 心跳循环。
- `runner.start()` 会并发启动两条任务：
  - `_run_tick_loop()`
  - `_run_bidask_loop()`
- 接收到 `SIGINT/SIGTERM` 时，走 `stop_async()` 做 graceful shutdown。

### 1.3 输入输出模型
- 输入：Redis Streams（consumer group）
  - `"{env}:stream:tick:*"`
  - `"{env}:stream:bidask:*"`
- Tick 路径主要输出：
  - Redis 当前 K（`k:current`）
  - Redis KBar ZSET（`k:zset`）
  - Postgres `kbar_1m` 持久化
- BidAsk 路径主要输出：
  - Redis 最新指标（`metrics:latest`）
  - Redis 指标序列（`metrics:zset`）

### 1.4 消费/ACK 语义
- 每轮会先尝试 `XAUTOCLAIM`（回收 pending），再 `XREADGROUP` 读新消息。
- `handler` 返回 `True` 才会 `XACK`。
- Tick 的关键语义是“写 Redis +（有归档时）写 PG 成功后 ACK”；失败不 ACK，交给后续 reclaim 重试。

### 1.5 当前配置重点（.env）
- `AGGREGATOR_READ_COUNT=100`
- `AGGREGATOR_BLOCK_MS=1000`
- `AGGREGATOR_TICK_CONSUMER=agg-tick-1ni`
- `AGGREGATOR_BIDASK_CONSUMER=agg-bidask-1`

---

## 2. 目前“卡住”问题总结

### 2.1 现象描述
- 当 tick 或 bidask 某一路持续有流量时，另一条 loop 会出现明显延迟，体感像“被卡住”。
- 不是任务没启动，而是调度公平性不足，导致某一路长期抢占执行时间。

### 2.2 根因（代码层）

1. 两条 loop 在同一个 asyncio event loop 上运行，但核心消费是同步调用  
- `consume_tick_once()` / `consume_bidask_once()` 都是同步函数（非 async）。
- 内部 Redis 读写与 DB 写入均是同步执行。

2. 只有“本轮处理 0 条”才会 `await asyncio.sleep(0.1)`  
- 一旦某一路持续有消息（`processed > 0`），该 loop 本轮不会主动让出执行权。
- 在高吞吐时会形成“谁一直有活，谁一直占着跑”的效果。

3. `XREADGROUP` 使用 `block=AGGREGATOR_BLOCK_MS`，且当前是同步 Redis client  
- `AGGREGATOR_BLOCK_MS=1000`，意味着调用线程可能被阻塞最多约 1 秒/次。
- 由于这发生在 event loop 所在线程，会放大对另一条任务和 runtime 心跳的影响。

4. Tick 路径额外有同步 DB commit  
- `_persist_kbar()` 中 `session.commit()` 为同步阻塞操作。
- 在 tick 归档密集时，进一步拉长 tick loop 占用时间。

### 2.3 为什么“合并 tick/bidask 调度写入”不是主解
- 合并后耦合更高：tick 慢会直接拖慢 bidask。
- 没解决根因：同步阻塞 I/O 仍在，同样会卡 event loop。
- ACK 语义会变复杂（tick 与 bidask 成功条件并不完全一致）。

### 2.4 结论
- 本质问题是：**单 event loop 上跑同步阻塞 I/O + 有消息时不主动让出执行权**。
- 所以表现为“两个 loop 互相卡住”，但底层机制是调度饥饿与阻塞，而不是逻辑死锁。

---

## 3. 建议修复方向（按风险从低到高）

### 3.1 低风险快速缓解
- 在两条 loop 每轮处理后，无论 `processed` 是否为 0，都执行一次 `await asyncio.sleep(0)`，保证协作式让出。
- 这可以先明显改善“单路抢占”问题，但不能彻底消除同步阻塞导致的停顿。

### 3.2 中期修复
- 将 Redis 访问迁移到 async 客户端（或先用 `asyncio.to_thread` 包装同步 Redis 调用）。
- 将 PG 持久化写入从主消费 loop 脱耦（线程池/内部队列批量落库）。

### 3.3 长期稳态
- 维持 tick / bidask 逻辑分离（隔离 backpressure）。
- 分别设置吞吐、超时和错误预算，避免互相放大影响。

