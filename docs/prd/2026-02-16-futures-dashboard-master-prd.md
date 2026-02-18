# 期貨監控平台 Master PRD

- 版本: v1.0
- 日期: 2026-02-16
- 狀態: 實作草案
- 參考: `docs/plans/2026-02-16-futures-dashboard-design.md`

## 1. 產品意圖
建立前後端分離的期貨監控平台，MVP 聚焦台指近月期貨即時快照，並保留可擴充的 domain 邊界以支援後續指標與分析。

## 2. MVP 目標
1. 提供近即時期貨快照給儀表板使用者。
2. 對所有保護 API 強制 JWT + RBAC。
3. 透過 mock webhook 支援單一方案訂閱流程。
4. 以 Docker Compose 本地部署並維持未來雲端遷移邊界。

## 3. 系統約束
1. 前端: React。
2. 後端: FastAPI 模組化單體。
3. 資料庫: PostgreSQL + Redis。
4. 訊息佇列: Redis Streams。
5. 即時傳輸: SSE (1 秒推送節奏)。
6. 併發目標: 約 200 同時在線使用者。

## 4. Domain 清單
1. Market Data Ingestion
- 負責: 來源連線、資料標準化、寫入 Stream。

2. Indicator & Realtime
- 負責: 消費 Stream、計算快照、快取與 SSE 推送。

3. Identity & Access
- 負責: 認證、JWT 驗證、RBAC 權限檢查。

4. Subscription & Billing (Mock)
- 負責: 訂閱意圖、mock webhook、訂閱狀態。

5. Admin & Audit
- 負責: 管理端操作與審計事件記錄。

6. Historical Analytics (Post-MVP)
- 負責: 長期歷史、排程與分析查詢。

## 5. 共同基礎依賴 (Platform/Infra)
- Monorepo 結構與模組邊界。
- Docker Compose 與環境變數配置。
- PostgreSQL/Redis 啟動與基本 schema。
- 基本可觀測性 (logs / error metrics / audit event 接收端)。

## 6. 依賴關係與建議執行順序 (依賴排序)
0. 先完成「共同基礎依賴」。
1. Identity & Access
- 其他 domain 的保護 API 依賴權限層。
2. Subscription & Billing (Mock)
- 依賴 Identity & Access 進行身分與權限控制。
3. Admin & Audit
- 依賴 Identity & Access 進行管理端保護。
4. Market Data Ingestion
- 依賴基礎設施與 Redis Streams。
5. Indicator & Realtime
- 依賴 Market Data Ingestion 與 Identity & Access。
6. Historical Analytics (Post-MVP)
- 依賴 Market Data Ingestion 與 Indicator & Realtime 產出。

## 7. 跨域契約
1. `TickEvent`
- `symbol`, `ts`, `price`, `volume`, `source`, `market_type`

2. `Snapshot`
- `symbol`, `ts`, `last_price`, `change`, `volume`, `status`

3. Redis Stream 與 Key
- Stream: `stream:near_month_txf`
- Latest cache: `latest:snapshot:near_month_txf`
- Dead-letter stream: `stream:dead:near_month_txf`

## 8. 全域安全規則
1. 後端授權為真實權限來源。
2. 前端 route guard 僅為 UX 層。
3. 所有受保護 CRUD 必須經過 middleware + RBAC。
4. 敏感操作與拒絕請求需寫入審計。

## 9. 全域可靠性規則
1. 來源斷線需 exponential backoff 重連。
2. Stream 消費需 ack 成功訊息。
3. 反覆失敗移入 dead-letter stream。
4. 單筆失敗不得阻塞整體管線。

## 10. 共同驗收標準
1. 正常狀態下每秒推送快照。
2. 未授權請求正確回應 401/403。
3. Mock webhook 可啟用訂閱權限。
4. 200 連線基準測試不出現關鍵故障。

## 11. 文件結構
1. 本文件定義跨域共通約束與依賴順序。
2. Domain 詳細規格請參考:
- `docs/prd/domains/01-market-data-ingestion-prd.md`
- `docs/prd/domains/02-indicator-realtime-prd.md`
- `docs/prd/domains/03-identity-access-prd.md`
- `docs/prd/domains/04-subscription-billing-prd.md`
- `docs/prd/domains/05-admin-audit-prd.md`
- `docs/prd/domains/06-historical-analytics-prd.md`
