# Domain PRD: Indicator & Realtime

- Domain: Indicator & Realtime
- 版本: v1.0
- 日期: 2026-02-16
- 上層: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain 目標
消費 Stream 事件並計算快照，將最新快照快取並透過 SSE 以 1 秒節奏推送。

## 2. 範圍 (MVP)
### 2.1 內含
1. Redis Streams consumer group 消費。
2. 快照計算與狀態輸出。
3. Redis latest snapshot cache。
4. SSE 推送 `GET /realtime/near-month`。
5. 最小化快照持久化 (PostgreSQL)。

### 2.2 不含
1. WebSocket 改造。
2. 多商品或多儀表板。
3. 高階分析與歷史查詢。

## 3. 依賴清單
1. 共同基礎依賴: Redis、PostgreSQL、SSE 基本設定。
2. `01-market-data-ingestion` 產出 `TickEvent`。
3. `03-identity-access` (若 SSE 需要授權)。

## 4. 輸出與介面
1. 快照輸出契約
- `Snapshot { symbol, ts, last_price, change, volume, status }`

2. Redis keys
- `latest:snapshot:near_month_txf`

3. SSE endpoint
- `GET /realtime/near-month`

## 5. 處理規則
1. 消費成功需 ack。
2. 計算失敗需重試，超過上限進 dead-letter。
3. 1 秒節奏推送，避免阻塞事件消費。

## 6. 失敗模式
1. Stream 消費中斷
- 行動: 重新連線並恢復 consumer group。

2. 計算錯誤
- 行動: 重試並寫入 dead-letter。

3. SSE 連線中斷
- 行動: 個別連線斷線不影響其他使用者。

## 7. 可觀測性
1. 消費延遲與 lag。
2. 計算錯誤率與重試次數。
3. SSE 線上連線數。

## 8. 測試情境
1. Stream -> 快照 -> Redis latest 的完整流程。
2. 計算失敗重試與 dead-letter。
3. SSE 連線可持續推送。

## 9. 執行順序 (依賴排序)
1. 在 `01-market-data-ingestion` 完成後。
2. 若需要授權，需在 `03-identity-access` 後。

## 10. 驗收標準
1. 快照每秒更新並可在 SSE 接收。
2. 消費錯誤不阻塞整體管線。
3. 快照可持久化與快取一致。
