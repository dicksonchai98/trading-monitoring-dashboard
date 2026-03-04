# Domain PRD: Subscription & Billing (Stripe)

- Domain: Subscription & Billing (Stripe)
- 版本: v1.1
- 日期: 2026-02-25
- 上層: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain 目標
提供單一方案訂閱流程，包含 Checkout Session 建立、Stripe webhook 回呼與訂閱狀態啟用。

## 2. 範圍 (MVP)
### 2.1 內含
1. 單一方案訂閱（Stripe Price）。
2. Checkout Session 建立與導轉。
3. Stripe webhook 驗證與狀態轉換。
4. 訂閱狀態影響 RBAC 授權。
5. Customer Portal Session 建立（付款方式更新/取消入口）。

### 2.2 不含
1. 多方案與複雜計費模型。
2. 退款、折扣碼、稅務自動化。
3. 跨區幣別策略與會計對帳系統。

## 3. 依賴清單
1. 共同基礎依賴: PostgreSQL、環境變數、基本可觀測性。
2. `03-identity-access` 用於保護訂閱 API 與權限更新。
3. Stripe API key、Webhook secret、Price ID 設定完成。

## 4. 輸出與介面
1. API
- `POST /billing/checkout`
- `POST /billing/webhooks/stripe`
- `GET /billing/status`
- `POST /billing/portal-session`

2. 狀態
- `pending` -> `active` / `past_due` / `canceled`

## 5. 處理規則
1. webhook 需驗證 Stripe 簽章（`Stripe-Signature`）。
2. 事件處理需具備冪等性（以 event id 去重）。
3. `checkout.session.completed` 成功後需建立或更新 subscription 與 entitlement。
4. `invoice.paid` 維持有效狀態；`invoice.payment_failed` 標記 `past_due` 並觸發通知事件。
5. 成功啟用需更新授權結果。

## 6. 失敗模式
1. webhook 驗證失敗
- 行動: 拒絕並記錄。

2. Checkout Session 建立失敗
- 行動: 返回 5xx 並記錄 provider 錯誤碼。

3. 狀態轉換錯誤
- 行動: 回滾並告警。

## 7. 可觀測性
1. checkout 建立成功/失敗次數。
2. webhook 驗證失敗次數。
3. webhook 事件處理延遲與重送率。
4. 訂閱狀態分佈。

## 8. 測試情境
1. checkout session 建立成功。
2. `checkout.session.completed` 啟用訂閱。
3. `invoice.paid` 與 `invoice.payment_failed` 轉換正確。
4. 重送 webhook 仍為冪等。

## 9. 執行順序 (依賴排序)
1. 在 `03-identity-access` 完成後。
2. 可與 `05-admin-audit` 平行，但需先具備 webhook 驗簽設定。

## 10. 驗收標準
1. checkout -> webhook -> active 全流程成功。
2. 訂閱狀態能影響授權判斷。
3. webhook 驗證失敗會被拒絕。
