# OTP Email Verification and Notification Service Design V2 (2026-03-23)

## 1. 目标与范围

本设计定义一套可复用的邮件发送基础能力，覆盖两个 domain：

- OTP Verification Domain（MVP 必做）
- Notification Email Domain（MVP 先做能力，不先绑定具体业务触发）

MVP 明确范围：

- OTP 仅用于「注册前 Email 验证」
- OTP channel 固定 `email`（不支持 SMS / TOTP / 语音）
- 发送 provider 先用 `SendGrid`
- MQ 先用 `Redis Streams`
- 注册沿用既有 `POST /auth/register`，扩充 verification token 校验

## 2. 已确认决策

1. 已注册 email 回覆明确错误（接受可枚举风险）
2. `send-otp` 为受理语义（accepted），不保证邮件已送达
3. cooldown 内重复发送直接拒绝，回 `429` 与剩余秒数
4. OTP verify 成功后发 `opaque` 一次性 verification token（非 JWT）
5. Notification 先完成发送平台能力，不先定义业务触发场景
6. 不开内部 notification API；先做 service method + 测试
7. MVP 纳入 SendGrid webhook 回写

## 3. 架构总览

```text
Client
  |
  v
FastAPI API
  |
  +--> Auth Service (OTP)
  |
  +--> Notification Service (domain abstraction)
  |
  v
PostgreSQL (otp_challenges / verification_tokens / email_outbox / delivery_logs)
  |
  v
Outbox Dispatcher
  |
  v
Redis Streams
  |
  v
Email Worker
  |
  v
SendGrid API
  |
  v
SendGrid Event Webhook -> FastAPI Webhook Endpoint -> delivery logs/status update
```

## 4. API 契约（Auth）

### 4.1 `POST /auth/email/send-otp`

- 输入：`email`
- 行为：
  - 校验 email 格式
  - 若 email 已注册，明确返回已注册错误
  - 执行 cooldown 与 rate limit
  - 建立/更新 OTP challenge
  - 同交易写入 outbox 任务
  - 回传 accepted（不等待 provider）
- 错误：
  - `429`（cooldown 或 rate limit），含 `retry_after_seconds`

### 4.2 `POST /auth/email/verify-otp`

- 输入：`email`, `otp_code`
- 行为：
  - 读取该 email 最新有效 challenge
  - 校验过期/锁定/尝试上限
  - 比对 OTP hash（constant-time）
  - 成功则标记 challenge 为 `verified`
  - 签发短效一次性 `verification_token`（opaque）

### 4.3 `POST /auth/register`（沿用现有 route）

- 新增输入字段：`verification_token`
- 前置校验：
  - token 未过期、未使用
  - `purpose=register`
  - token 绑定 email 与注册 email 一致
- 成功注册后原子更新：
  - token 标记 `used_at`
  - challenge 由 `verified -> consumed`

## 5. 状态机

### 5.1 `otp_challenges.status`

- `pending -> verified -> consumed`
- `pending -> expired`
- `pending -> locked`
- `expired/locked/consumed` 不可再验证

并发规则：

- 同 email 只允许一个有效 `pending challenge`

## 6. 数据模型

### 6.1 `otp_challenges`

关键字段：

- `id`
- `email`
- `otp_hash`
- `status` (`pending|verified|expired|locked|consumed`)
- `expires_at`
- `verify_attempts`
- `max_attempts`
- `last_sent_at`
- `created_at`, `updated_at`

### 6.2 `otp_verification_tokens`（新增）

关键字段：

- `id`
- `token_hash`
- `challenge_id`
- `email`
- `purpose`（MVP 固定 `register`）
- `expires_at`
- `used_at`
- `created_at`

约束：

- 仅 `used_at is null` 可消费
- 单 token 仅可使用一次

### 6.3 `email_outbox`

关键字段：

- `id`
- `email_type` (`otp|notification`)
- `recipient`
- `template_name`
- `payload_json`
- `status` (`pending|processing|sent|failed`)
- `retry_count`
- `max_retry`
- `idempotency_key`
- `created_at`, `updated_at`

约束：

- `idempotency_key` 唯一索引

### 6.4 `email_delivery_logs`

关键字段：

- `id`
- `outbox_id`
- `provider`（MVP: `sendgrid`）
- `provider_message_id`
- `event_type`
- `result`
- `error_message`
- `attempt_no`
- `event_at`
- `provider_payload_json`

## 7. 一致性与防重

### 7.1 Outbox 主路径

- 业务交易与 outbox 写入在同一 DB transaction
- dispatcher 异步把 `pending outbox` 推送到 `Redis Streams`
- worker 仅从 MQ 消费并更新 outbox/log

### 7.2 防重策略

- API 层：cooldown / rate limit / 业务幂等检查
- Outbox 层：`idempotency_key` 唯一约束
- Worker 层：
  - 若 outbox 已 `sent` 直接跳过
  - `processing` 超时可回收并重试

## 8. 重试策略

### 8.1 OTP 邮件

- 最多重试 3 次
- 指数退避
- 失败后保持 `failed`，要求用户重新发送 OTP

### 8.2 Notification 邮件

- 最多重试 5 次
- 指数退避
- 超限转 `failed`，后续可接人工处理或补偿任务

## 9. SendGrid 整合与 Webhook

MVP provider：`SendGrid`

Webhook 回写事件（MVP 最小集）：

- `delivered`
- `bounce`
- `dropped`
- `deferred`

处理原则：

- webhook endpoint 做签章验证
- 事件回写 `email_delivery_logs`
- 必要时同步更新 outbox 最终状态

## 10. Notification Domain（MVP 策略）

MVP 先完成通用能力，不先绑定业务触发：

- 提供 Notification service method
- 可创建 notification outbox 任务并走完整寄信链路
- 通过测试验证链路可用

后续再定义具体触发场景（如订阅状态变更、风控告警等）。

## 11. 安全与观测

### 11.1 安全

- OTP 不可明文存库，仅存 hash
- OTP 比对使用 constant-time compare
- register token 一次性消费，防重放

### 11.2 指标

至少记录：

- OTP 请求次数
- OTP 验证成功率/失败率
- 邮件发送成功率
- Redis stream backlog
- worker 失败次数
- provider 错误码分布

### 11.3 告警

- OTP 失败率异常升高
- outbox `pending` 堆积
- worker 连续失败
- provider 错误突增

## 12. 测试策略（MVP 最小集）

- Unit：
  - OTP 状态机转换
  - verification token 一次性消费
  - idempotency key 生成与约束
- Integration：
  - outbox -> Redis Streams -> worker -> SendGrid adapter
  - webhook 回写状态更新
- API：
  - `send-otp / verify-otp / register` 全流程
  - cooldown、rate limit、错误次数上限
- Concurrency：
  - 重复发送
  - 重复消费
  - register 重放 token

