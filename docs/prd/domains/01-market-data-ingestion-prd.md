# Domain PRD: Market Data Ingestion

- Domain: Market Data Ingestion
- 版本: v1.0
- 日期: 2026-02-16
- 上層: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain 目標
從 Shioaji 取得台指近月期貨，標準化為內部事件並寫入 Redis Streams。

## 2. 範圍 (MVP)
### 2.1 內含
1. 單一供應商: Shioaji。
2. 單一商品: 台指近月期貨。
3. Tick 資料標準化與驗證。
4. 寫入 `stream:near_month_txf`。

### 2.2 不含
1. 多供應商聚合。
2. 期權/現貨/法人資料。
3. 歷史資料抓取與排程。

## 3. 依賴清單
1. 共同基礎依賴: Redis、環境變數配置、基本可觀測性。
2. 無其他 domain 強制依賴。

## 4. 輸出與介面
1. 內部 adapter 介面
- `connect()`
- `subscribe(symbol)`
- `on_message(payload)`

2. 事件輸出契約
- `TickEvent { symbol, ts, price, volume, source, market_type }`

## 5. 處理規則
1. 無效 payload 需拒絕並記錄結構化錯誤。
2. 時間戳需統一格式化。
3. 斷線需 exponential backoff 重連。

## 6. 失敗模式
1. 來源不可用
- 行動: 重試並記錄系統事件。

2. Stream 寫入失敗
- 行動: 短暫重試並上報錯誤。

## 7. 可觀測性
1. Ingestion rate。
2. Stream 寫入成功/失敗計數。
3. 來源重連次數。

## 8. 測試情境
1. 正常 payload 標準化。
2. 無效 payload 拒絕。
3. 斷線後重連。
4. Stream 寫入與重試。

## 9. 執行順序 (依賴排序)
1. 在共同基礎依賴完成後執行。
2. 需先於 `02-indicator-realtime` 與 `06-historical-analytics`。

## 10. 驗收標準
1. Shioaji tick 可轉成 `TickEvent` 並寫入 Stream。
2. 斷線可自動恢復。
3. 錯誤可被 logs/metrics 觀測。

