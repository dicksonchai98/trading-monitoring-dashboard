# Stripe Subscription TRD (2026-02-25)

## 1. 目標與背景
原 MVP 訂閱流程採用 `mock webhook`。本 TRD 將其替換為 Stripe 實作，維持「單一方案、RBAC 聯動、SSE/市場資料架構不變」的原則。

## 2. 範圍
### 2.1 In Scope
1. 單一 Stripe Price 方案（MVP）。
2. 建立 Checkout Session 並由前端導轉。
3. 以 Stripe Webhook 同步訂閱狀態。
4. 開通/降級 entitlement 與 RBAC 判斷聯動。
5. 建立 Customer Portal Session。

### 2.2 Out of Scope
1. 多方案與升降級 prorations。
2. 折扣碼、稅務、自動開票。
3. 第三方會計或對帳整合。

## 3. 系統設計
### 3.1 後端模組
1. `billing`:
- checkout session 建立
- portal session 建立
- webhook 驗簽與事件處理
2. `subscription`:
- 本地訂閱狀態轉換
- entitlement 更新
3. `audit`:
- 記錄安全與管理操作事件

### 3.2 API 契約 (MVP)
1. `POST /billing/checkout` (protected: `user`/`admin`)
- input: `price_id` (或後端固定單一 `PRICE_ID`)
- output: `checkout_url`, `session_id`
2. `POST /billing/webhooks/stripe` (public, signature required)
3. `GET /billing/status` (protected: `user`/`admin`)
4. `POST /billing/portal-session` (protected: `user`/`admin`)
- output: `portal_url`

### 3.3 Webhook 事件
1. `checkout.session.completed`
- 建立/更新本地 subscription
- 狀態轉 `active`
- 更新 entitlement
2. `invoice.paid`
- 維持 `active`
3. `invoice.payment_failed`
- 轉 `past_due`，觸發通知事件
4. `customer.subscription.deleted`
- 轉 `canceled`，撤銷 entitlement

## 4. 資料模型調整
### 4.1 subscription 表 (新增欄位)
1. `user_id` (FK -> `users.id`, indexed, required)
2. `stripe_customer_id` (nullable unique)
3. `stripe_subscription_id` (nullable unique)
4. `stripe_price_id`
5. `current_period_end`
6. `status` (`pending|active|past_due|canceled`)

### 4.2 billing_event 表 (新增)
1. `stripe_event_id` (unique)
2. `event_type`
3. `processed_at`
4. `payload_hash`
5. `status` (`processed|ignored|failed`)

用途: webhook 去重與審計追蹤。

### 4.3 users 表 (最小調整)
1. 新增 `stripe_customer_id` (nullable unique)。
2. `email` 維持 `NOT NULL + UNIQUE`（若既有 schema 尚未加唯一約束，需補上）。

用途:
1. 讓 checkout/portal 可以快速對應 Stripe customer。
2. 避免同 email 建立多個 customer 導致訂閱關聯混亂。

## 5. 狀態機與冪等
1. `pending -> active`
2. `active -> past_due`
3. `past_due -> active`
4. `active|past_due -> canceled`

冪等策略:
1. 先檢查 `stripe_event_id` 是否已處理。
2. 每個事件處理包在 DB transaction。
3. 重送事件返回 200 並標記 `ignored`。

## 6. 安全需求
1. 必須驗證 `Stripe-Signature`。
2. 不信任前端成功頁，僅以 webhook 作為最終成功依據。
3. `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET` 僅存放於後端環境變數。
4. webhook handler 僅暴露必要路由，不綁定使用者 session。

## 7. 可觀測性
1. checkout 成功率/失敗率。
2. webhook 驗簽失敗次數。
3. webhook 處理延遲與失敗率。
4. 訂閱狀態分佈與狀態轉換次數。

## 8. 測試策略
1. Unit:
- 事件映射與狀態機轉換
- 冪等去重
2. Integration:
- checkout 建立 -> webhook -> entitlement 更新
3. API:
- `/billing/checkout` 權限與輸入驗證
- webhook 驗簽失敗回應
4. Non-functional:
- webhook 重送壓力測試
- 單事件失敗不阻塞其他事件

## 9. 部署與設定
必要環境變數:
1. `STRIPE_SECRET_KEY`
2. `STRIPE_WEBHOOK_SECRET`
3. `STRIPE_PRICE_ID`
4. `STRIPE_SUCCESS_URL`
5. `STRIPE_CANCEL_URL`

## 10. 遷移計畫 (Mock -> Stripe)
1. 移除 `mock webhook` 啟用路徑。
2. 上線 Stripe webhook endpoint 與事件去重表。
3. 將原 `pending` 訂閱以一次性腳本遷移為 `canceled` 或人工重建。
4. 驗證 RBAC entitlement 更新鏈路後切流。
