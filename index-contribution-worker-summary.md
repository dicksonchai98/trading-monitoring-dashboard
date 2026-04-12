# Index Contribution Worker Summary

## 1. 这个 worker 目前做了什么（代码现状）

- 入口：`apps/backend/workers/index_contribution_worker.py`
- 运行时：通过 `StreamProcessingWorkerRuntime` 启动 `IndexContributionRunner`
- 核心能力（已实现）：
  - 计算个股对 `TSE001` 的 `contribution_points`
  - 维护 in-memory `symbol_state`、`top/bottom ranking`、`sector aggregate`
  - 发布 Redis 实时状态（symbol latest / ranking / sector）
  - 以 1 分钟边界 flush 到三张快照表
  - 每日重置、warm restart 重建、Redis/DB 重试与告警计数

## 2. 它消费哪个 stream

## 2.1 当前代码中的事实

`IndexContributionRunner` 当前代码里**没有** `xreadgroup/xautoclaim` 消费循环实现；`start()` 只启动了一个 idle loop（`_run_loop` 仅 sleep）。

也就是说：
- 目前该 worker 的“消费上游事件”能力在 runner 内尚未落地到具体 Redis Stream 读取逻辑。

## 2.2 规范/设计期望

根据 OpenSpec 与设计文档：
- 期望输入是 upstream `spot latest updates`（spot 最新价事件流/状态管线）
- 配置存在消费者组参数：
  - `INDEX_CONTRIBUTION_GROUP` 默认 `index-contrib:spot`
  - `INDEX_CONTRIBUTION_CONSUMER` 默认 `index-contrib-1`
- 但具体 stream key 名称在当前实现未被绑定到读取逻辑。

## 3. Redis keys（已实现）

worker 会写入以下 key：

1. Symbol latest（String JSON）
- `{env}:state:index_contrib:{index_code}:{trade_date}:{symbol}:latest`

2. Ranking top（ZSET）
- `{env}:state:index_contrib:{index_code}:{trade_date}:ranking:top`

3. Ranking bottom（ZSET）
- `{env}:state:index_contrib:{index_code}:{trade_date}:ranking:bottom`

4. Sector aggregate（String JSON）
- `{env}:state:index_contrib:{index_code}:{trade_date}:sector`

其中 `index_code` 当前默认是 `TSE001`。

## 4. In-memory state（已实现）

主要 state 在 `IndexContributionEngine` 与 `IndexContributionRunner`：

1. Engine state
- `symbol_state: dict[symbol, symbol_payload]`
- `sector_aggregate: dict[sector, contribution_points]`
- `_processed_event_ids: set[str]`（幂等去重）

2. Runner state
- `_active_trade_date`
- `_last_flushed_minute_ts`
- `_constituents`（每日权重/名称/sector 元数据）
- `_sector_mapping`
- Redis/DB 连续失败计数与告警阈值控制

## 5. 持久化 state（已实现）

分钟快照写入三张表：

1. `index_contribution_snapshot_1m`
- 维度：`index_code + minute_ts + symbol`
- 内容：symbol 贡献、价格、权重、涨跌幅、top/bottom 名次等

2. `index_contribution_ranking_1m`
- 维度：`index_code + minute_ts + ranking_type + rank_no`
- 内容：top/bottom 排名快照

3. `sector_contribution_snapshot_1m`
- 维度：`index_code + minute_ts + sector`
- 内容：sector 聚合贡献

## 6. 最后 serving 到哪些 endpoint

## 6.1 当前代码现状

`index_contribution_worker` 本身不注册任何 HTTP route（有测试保证）。

目前 backend 已注册的 serving endpoints 是 `/v1/kbar/*`、`/v1/metric/*`、`/v1/stream/sse`，**不包含 index contribution 专用 endpoint**。

## 6.2 设计文档中的期望 serving 能力

设计文档列出的下游可暴露能力是：
- 当前个股 contribution
- top20/bottom20 ranking
- 当前 sector contribution
- 分钟级历史 contribution snapshots

当前仓库尚未看到这些能力对应的已实现 FastAPI endpoint。

## 7. Endpoint 对应 schema（按“上面 schema”整理）

由于 index contribution endpoint 尚未落地，下面给的是“推荐按现有 state/schema 对齐”的响应结构。

1. `GET /v1/index-contribution/symbol/latest`
- Source: Redis key `{env}:state:index_contrib:{index_code}:{trade_date}:{symbol}:latest`
- Response schema:
```json
{
  "symbol": "2330",
  "symbol_name": "TSMC",
  "sector": "Semiconductor",
  "last_price": 950.0,
  "prev_close": 940.0,
  "weight": 0.31,
  "pct_change": 0.010638,
  "contribution_points": 3.19,
  "updated_at": "2026-04-06T10:30:00+08:00"
}
```

2. `GET /v1/index-contribution/ranking/latest?type=top|bottom&limit=20`
- Source: Redis ZSET `ranking:top` / `ranking:bottom`（member=symbol, score=contribution_points）
- Response schema（建议 enrich）：
```json
{
  "index_code": "TSE001",
  "trade_date": "2026-04-06",
  "ranking_type": "top",
  "items": [
    {
      "rank_no": 1,
      "symbol": "2330",
      "symbol_name": "TSMC",
      "sector": "Semiconductor",
      "contribution_points": 3.19
    }
  ]
}
```

3. `GET /v1/index-contribution/sector/latest`
- Source: Redis key `{env}:state:index_contrib:{index_code}:{trade_date}:sector`
- Response schema：
```json
{
  "index_code": "TSE001",
  "trade_date": "2026-04-06",
  "sectors": {
    "Semiconductor": 4.3,
    "Finance": -1.2
  }
}
```

4. `GET /v1/index-contribution/snapshot/1m`
- Source: PostgreSQL 三张快照表
- Response schema（建议分层返回）：
```json
{
  "index_code": "TSE001",
  "from": "2026-04-06T09:00:00+08:00",
  "to": "2026-04-06T13:30:00+08:00",
  "symbol_snapshots": [
    {
      "trade_date": "2026-04-06",
      "minute_ts": "2026-04-06T10:30:00+08:00",
      "symbol": "2330",
      "symbol_name": "TSMC",
      "sector": "Semiconductor",
      "last_price": 950.0,
      "prev_close": 940.0,
      "weight": 0.31,
      "pct_change": 0.010638,
      "contribution_points": 3.19,
      "rank_top": 1,
      "rank_bottom": null,
      "weight_version": "v1"
    }
  ],
  "ranking_snapshots": [
    {
      "trade_date": "2026-04-06",
      "minute_ts": "2026-04-06T10:30:00+08:00",
      "ranking_type": "top",
      "rank_no": 1,
      "symbol": "2330",
      "symbol_name": "TSMC",
      "sector": "Semiconductor",
      "contribution_points": 3.19,
      "weight_version": "v1"
    }
  ],
  "sector_snapshots": [
    {
      "trade_date": "2026-04-06",
      "minute_ts": "2026-04-06T10:30:00+08:00",
      "sector": "Semiconductor",
      "contribution_points": 4.3,
      "weight_version": null
    }
  ]
}
```

## 8. 一句话结论

这个 worker 目前已经把“计算 + Redis状态发布 + 分钟快照落库”做好了，但“从哪个 spot stream 真正消费事件”与“对外 contribution endpoints”在代码里还没接上，当前属于下游 serving 层待实现状态。
