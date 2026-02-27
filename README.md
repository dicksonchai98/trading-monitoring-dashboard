# Trading Monitoring Dashboard

台指近月期貨監控儀表板（MVP）Monorepo。  
前端使用 React SPA，後端使用 FastAPI，透過 Redis Streams + SSE 提供每秒更新的即時監控資料。

## Design Baseline

主要設計基線文件：

- `docs/plans/2026-02-16-futures-dashboard-design.md`
- `AGENTS.md`（工作流、技術邊界、測試與安全基線）

若實作行為與基線不一致，需同步更新 `docs/` 與 `openspec/`。

## MVP Scope

In scope:

- 台指近月期貨即時監控
- SSE 每秒推送更新
- JWT + RBAC（`admin` / `member` / `visitor`）
- 單方案訂閱流程（mock webhook）

Out of scope:

- 多商品全覆蓋
- 歷史回補與爬蟲管線
- 真實金流供應商完整整合
- 多方案計費模型

## Architecture Overview

### Market Data Flow

1. `market_ingestion` 接收 Shioaji 原始行情
2. 正規化為共享事件 `TickEvent`
3. 寫入 Redis Stream：`stream:near_month_txf`
4. `indicator_engine` 以 consumer group 消費事件
5. 計算近月快照
6. 寫入：
   - PostgreSQL（最小持久化快照）
   - Redis（`latest:snapshot:near_month_txf`）
7. `realtime` 模組每秒透過 SSE 推送至前端

### Subscription Flow (Mock)

1. 建立訂閱意圖並寫入 PostgreSQL
2. 觸發內部 mock webhook
3. 啟用訂閱並更新 RBAC 權限

### Access Control

1. 使用 JWT 進行認證
2. 前端做頁面層路由守衛（UX）
3. 後端 API 邊界強制 RBAC（source of truth）
4. 管理操作寫入 audit 記錄

## Repository Structure

- `apps/frontend`: React 前端應用（儀表板、頁面守衛、SSE 客戶端）
- `apps/backend`: FastAPI 模組化單體（auth、rbac、ingestion、realtime、subscription、admin、audit）
- `packages/shared/contracts`: 共享資料契約（`TickEvent`、`Snapshot`、RBAC enum）
- `packages/shared/config`: 共享環境變數 schema 與設定工具
- `infra`: 本機與部署相關設定
- `docs`: 設計與規格文件
- `openspec`: 變更規格工作流

## Quick Start

### 1) Backend

```bash
cd apps/backend
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2) Frontend

```bash
cd apps/frontend
npm install
npm run build
```

## Testing Baseline

- Unit: 指標邏輯、RBAC policy
- Integration: stream -> compute -> snapshot
- API: auth、權限路由、mock webhook
- Non-functional: SSE 連線數與 ingestion 重連穩定性

## Security and Reliability Baseline

- 受保護 API 必須由後端 RBAC 強制檢查
- 認證失敗需有一致 `401/403` 行為
- Stream 處理需具備 retry / ack / dead-letter
- SSE 連線失敗需隔離，不得影響其他連線
- 管理與安全相關操作需可稽核

## Boundary Rules

- `apps/*` 可以 import `packages/shared/*`
- `packages/shared/*` 不可 import `apps/*`
- shared 契約僅供建置時共享，前後端獨立部署
