# Domain PRD: Subscription & Billing (Mock)

- Domain: Subscription & Billing (Mock)
- 版本: v1.0
- 日期: 2026-02-16
- 上層: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain 目標
提供單一方案訂閱流程，包含 intent 建立、mock webhook 回呼與訂閱狀態啟用。

## 2. 範圍 (MVP)
### 2.1 內含
1. 訂閱意圖建立。
2. Mock webhook 驗證與狀態轉換。
3. 訂閱狀態影響 RBAC 授權。

### 2.2 不含
1. 真實金流或發票。
2. 多方案定價。
3. 退款/取消等複雜流程。

## 3. 依賴清單
1. 共同基礎依賴: PostgreSQL、環境變數、基本可觀測性。
2. `03-identity-access` 用於保護訂閱 API 與權限更新。

## 4. 輸出與介面
1. API
- `POST /subscriptions/intent`
- `POST /subscriptions/mock-webhook`

2. 狀態
- `pending` -> `active`

## 5. 處理規則
1. mock webhook 需驗證內部簽章。
2. 狀態轉換需具備冪等性。
3. 成功啟用需更新授權結果。

## 6. 失敗模式
1. webhook 驗證失敗
- 行動: 拒絕並記錄。

2. 狀態轉換錯誤
- 行動: 回滾並告警。

## 7. 可觀測性
1. intent 成功/失敗次數。
2. webhook 驗證失敗次數。
3. 訂閱狀態分佈。

## 8. 測試情境
1. intent 建立成功。
2. mock webhook 啟用訂閱。
3. 重送 webhook 仍為冪等。

## 9. 執行順序 (依賴排序)
1. 在 `03-identity-access` 完成後。
2. 可與 `05-admin-audit` 平行，但需先具備授權層。

## 10. 驗收標準
1. intent -> webhook -> active 全流程成功。
2. 訂閱狀態能影響授權判斷。
3. webhook 驗證失敗會被拒絕。

