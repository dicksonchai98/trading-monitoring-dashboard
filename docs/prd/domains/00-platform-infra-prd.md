# Domain PRD: Platform/Infra

- Domain: 共同基礎依賴 (Platform/Infra)
- 版本: v1.0
- 日期: 2026-02-16
- 上層: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain 目標
提供所有 domain 共用的基礎設施與工程骨架，確保可本地部署、可觀測、可擴充。

## 2. 範圍 (MVP)
### 2.1 內含
1. Monorepo 結構與模組邊界約束。
2. Docker Compose 與環境變數配置。
3. PostgreSQL/Redis 啟動與基本 schema/seed。
4. 基本可觀測性 (logs / error metrics / audit event 接收端)。

### 2.2 不含
1. 雲端部署腳本與 IaC。
2. 進階監控告警與 tracing。
3. 資料庫高可用與跨區備援。

## 3. 依賴清單
1. 無上游 domain 依賴。
2. 依賴本地 Docker 環境與 Compose。

## 4. 輸出與介面
1. 共用設定約定
- `.env` 變數命名規範。
- `docker-compose.yml` 服務清單與連線資訊。

2. 基礎資源
- PostgreSQL: 主要 schema 初始化。
- Redis: 連線與 Stream/Key 命名規範。

3. 可觀測性接收端
- 統一 log 格式與錯誤指標名稱。
- Audit event 接收端 (stub 或 mock)。

## 5. 處理規則
1. 所有服務需以環境變數注入設定。
2. Compose 服務需可一鍵啟動/停止。
3. 基礎 schema 需可重複執行且 idempotent。

## 6. 失敗模式
1. DB/Redis 無法啟動
- 行動: 提供明確錯誤與重試指引。

2. 環境變數缺失
- 行動: 啟動時阻擋並提示缺失項。

## 7. 可觀測性
1. 基礎服務啟動成功/失敗事件。
2. 連線健康檢查 (DB/Redis ping)。
3. Audit event 接收率與錯誤記錄。

## 8. 測試情境
1. Compose 一鍵啟動/關閉。
2. DB/Redis 連線健康檢查。
3. schema 初始化可重複執行。
4. 缺少環境變數時正確阻擋。

## 9. 執行順序 (依賴排序)
1. 必須先於所有 domain 執行完成。

## 10. 驗收標準
1. `docker-compose up` 可成功啟動 DB/Redis。
2. 基本 schema/seed 初始化成功且可重複。
3. log/metrics/audit 接收端可被調用。
