# 订阅事件现况总览（Subscription Event Flow）

更新时间：2026-03-20  
范围：当前仓库 `apps/backend` 中已实现的订阅/计费流程（Stripe）

## 1. 参与组件

- 路由入口：`POST /billing/checkout`、`GET /billing/status`、`POST /billing/portal-session`、`POST /billing/webhooks/stripe`
- 业务核心：`app/services/billing_service.py`
- Stripe 适配：`app/services/stripe_provider.py`
- 持久化：
  - `subscriptions`（订阅状态、stripe ids、entitlement）
  - `billing_events`（webhook 幂等与处理状态）
- 审计：`app/services/audit.py`（状态变更写 `subscription_status_changed`）

---

## 2. 订阅主流程（从创建到生效）

1. 用户登录后调用 `POST /billing/checkout`
2. 后端校验 price（只允许配置中的单一 MVP price）
3. 若用户没有 `stripe_customer_id`，先在 Stripe 建 customer 并回写 user
4. 在 `subscriptions` 中写入/更新为：
   - `status = pending`
   - `entitlement_active = false`
5. 返回 `checkout_url`、`session_id`
6. Stripe 回调 `POST /billing/webhooks/stripe`（`checkout.session.completed`）
7. 后端校验签名、做幂等、更新订阅为：
   - `status = active`
   - `entitlement_active = true`
8. 之后前端/客户端通过 `GET /billing/status` 读取当前订阅真值

---

## 3. 当前“所有订阅事件”处理情况

## 3.1 会改变订阅状态的事件（4类）

1. `checkout.session.completed`
- 目标状态：`active`
- entitlement：`true`
- 关键字段：`metadata.user_id`（优先）或 `customer` 反查用户，`subscription`

2. `invoice.paid`
- 目标状态：`active`
- entitlement：`true`
- 关键字段：`subscription`

3. `invoice.payment_failed`
- 目标状态：`past_due`
- entitlement：`false`
- 关键字段：`subscription`

4. `customer.subscription.deleted`
- 目标状态：`canceled`
- entitlement：`false`
- 关键字段：`id`（stripe subscription id）

> 每次成功应用状态变更，都会记录审计事件 `subscription_status_changed`。

## 3.2 会被接收但不改变状态的事件

以下常见 Stripe 事件目前策略是：`200 + {"status":"ignored"}`（仅记录幂等，不改订阅）：

- `payment_method.attached`
- `customer.created`
- `customer.updated`
- `customer.subscription.created`
- `setup_intent.created`
- `setup_intent.succeeded`
- `invoice.created`
- `invoice.finalized`
- `invoice.payment_succeeded`
- 以及其他未纳入映射的事件类型

---

## 4. 状态机（当前代码约束）

允许转移：

- `pending -> active | past_due | canceled`
- `active -> past_due | canceled`
- `past_due -> active | canceled`
- `canceled ->` 不可再转移

不允许转移或数据不完整时：事件会被 `ignored`（不抛业务异常，不改状态）。

---

## 5. Webhook 处理链路（细节）

1. 校验 `Stripe-Signature`
2. `construct_event` 验签并解析 payload
3. 验证 `event.id`、`event.type`
4. 按 `stripe_event_id` 写入 `billing_events`（唯一键）做幂等：
   - 已存在：直接 `ignored`
5. 执行生命周期映射逻辑
6. 更新 `billing_events.status`：
   - `processed`：事件已应用
   - `ignored`：事件有效但不需改状态
   - `failed`：处理中抛异常

---

## 6. API 侧可见结果与常见状态码

## 6.1 `POST /billing/checkout`
- `200`：返回 `checkout_url`、`session_id`
- `400 invalid_price_id`
- `404 user_not_found`
- `500 billing_error`

## 6.2 `GET /billing/status`
- `200`：返回 `status`、`stripe_price_id`、`current_period_end`、`entitlement_active`
- 若用户无订阅：`status = "none"`，`entitlement_active = false`

## 6.3 `POST /billing/portal-session`
- `200`：返回 `portal_url`
- `409 stripe_customer_not_found`
- `404 user_not_found`

## 6.4 `POST /billing/webhooks/stripe`
- `200 {"status":"processed"}`：成功应用
- `200 {"status":"ignored"}`：重复事件/不适用事件/非法转移
- `400 invalid_signature` 或 `400 invalid_event`
- `500 billing_error`

---

## 7. 关键“情境清单”（你可以直接当排查清单）

1. 用户刚 checkout 但尚未收到 webhook  
- 订阅应为 `pending`，`entitlement_active=false`

2. `checkout.session.completed` 首次到达  
- 订阅应转 `active`，`entitlement_active=true`

3. 同一个 `event.id` 重复投递  
- 返回 `ignored`，无重复副作用

4. 支付失败（`invoice.payment_failed`）  
- 订阅应转 `past_due`，`entitlement_active=false`

5. 后续补款成功（`invoice.paid`）  
- `past_due -> active`，权限恢复

6. 取消订阅（`customer.subscription.deleted`）  
- 订阅应转 `canceled`，权限关闭

7. 签名错误或缺失  
- `400`，不落订阅状态变更

8. 事件合法但找不到 user/subscription 映射  
- `ignored`（通常需检查 customer/subscription 映射）

---

## 8. 目前实现边界（重要）

- 单一价格计划（MVP），不支持多 plan 策略
- 事件映射只覆盖 4 个核心生命周期事件
- RBAC/entitlement 的触发点是订阅状态更新后的 `entitlement_active` 字段
- 控制面默认以 webhook 事件为状态真值来源

---

## 9. 代码定位（便于后续维护）

- `apps/backend/app/routes/billing.py`
- `apps/backend/app/services/billing_service.py`
- `apps/backend/app/services/stripe_provider.py`
- `apps/backend/app/repositories/subscription_repository.py`
- `apps/backend/app/repositories/billing_event_repository.py`
- `apps/backend/app/models/subscription.py`
- `apps/backend/app/models/billing_event.py`
- `apps/backend/docs/stripe-webhook-handling.md`
- `apps/backend/tests/test_billing_stripe_flow.py`
