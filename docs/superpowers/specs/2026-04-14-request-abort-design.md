# Frontend Request Abort Design

## Problem

目前前端页面在进入后会立即发起 API 请求。若用户在请求尚未完成时快速切换页面，或在共用 layout / sidebar 中触发其他动作（例如 billing portal / checkout 前置请求），旧请求仍会继续占用浏览器连接与处理链路，导致新页面或新动作感觉被前一个请求“卡住”。

现有代码里部分 `useEffect` 已有 `cancelled = true` 这种结果忽略模式，但这只能避免过期结果回写 state，**不能真正取消底层 fetch**。因此需要新增 `AbortController` 支援，把请求从“逻辑忽略”提升为“真实中止”。

## Goals

1. 页面切换时，中止上一页尚未完成的读取请求。
2. 同页依赖变化时，仅保留最后一次请求，旧请求立即 abort。
3. 共用 layout / sidebar 触发的前置请求（尤其是 Stripe portal / checkout 相关）也能被取消，避免干扰后续动作。
4. 被 abort 的请求不进入错误态，不显示 error toast，不污染现有 UX。
5. 保持现有 API helper 组织方式不变，优先沿用 `src\lib\api\client.ts` 作为统一入口。

## Non-Goals

1. 不额外扩展到登录、送 OTP、注册这类提交型 mutation。
2. 不重构 realtime SSE 管理逻辑。
3. 不在本次引入新的全局请求状态管理层。

## Scope

本次仅处理两类请求：

1. **页面进入即触发的读取请求**
   - 例如 dashboard、analytics、subscription、checkout result、session bootstrap 等初始化读取。
2. **共用 layout / sidebar 触发的前置请求**
   - 例如 billing portal session、checkout session 建立前的请求链。

## Current State

### Shared API client

`src\lib\api\client.ts`

- 已提供 `getJson` / `postJson`
- 底层统一走 `request()` + `fetch()`
- 当前 `ApiRequestOptions` 未普遍承接 `signal`

### Feature API helpers

典型位置：

- `src\features\dashboard\api\market-overview.ts`
- `src\features\analytics\api\analytics.ts`
- `src\features\subscription\api\billing.ts`
- `src\features\auth\api\auth.ts`

这些 helper 目前大多透过 shared client 发请求，适合统一加入可选 `signal`。

### High-risk call sites

1. `useEffect` 内直接发请求的 hooks / bootstrap 组件
2. React Query `queryFn`
3. sidebar dropdown 内点击后触发的 portal / checkout 前置请求

## Proposed Approach

采用**通用 API client + feature helper 透传 + 调用点建立 AbortController**的三层方案。

### 1. Shared client 层

在 `src\lib\api\client.ts`：

- 扩充 `ApiRequestOptions`，增加可选 `signal?: AbortSignal`
- `request()` 在 `fetch()` 时透传 `signal`
- 保持 `ApiError` 行为不变
- 新增一个可复用的 abort 判定 helper，例如：
  - `isAbortError(error: unknown): boolean`

设计原则：

- **abort 不是业务错误**
- 被 abort 的请求应由上层静默处理，不转成 `ApiError`

### 2. Feature API helper 层

所有页面读取型 API helper 与共用 layout 前置请求 helper 增加可选 `signal` 参数，并透传到 `getJson/postJson`。

目标覆盖：

- dashboard 读取 API
- analytics 读取 API
- subscription / checkout result / session bootstrap 相关读取 API
- billing portal / checkout 前置请求

参数形式统一为：

```ts
function getSomething(token: string, signal?: AbortSignal): Promise<T>
```

或

```ts
function getSomething(
  token: string,
  options?: { signal?: AbortSignal },
): Promise<T>
```

本次优先选择**与现有 helper 签名最接近、改动最小**的形式；若函数本身已有 options object，则并入现有 options。

## Call-site Design

### A. useEffect-driven requests

对于 `useEffect` 初始化请求：

1. effect 内创建 `AbortController`
2. 发请求时传入 `controller.signal`
3. cleanup 时调用 `controller.abort()`
4. catch 中若是 abort，则直接 return，不写 error state

模式示意：

```ts
useEffect(() => {
  const controller = new AbortController();

  void loadData(controller.signal).catch((error) => {
    if (isAbortError(error)) return;
    setError(...);
  });

  return () => controller.abort();
}, [deps]);
```

### B. React Query requests

对于 React Query：

- `queryFn` 需接住 query context 的 `signal`，或在闭包中显式传入
- 最终由 helper 透传到底层 fetch

目标是让**切页、query invalidation、依赖变化**时，React Query 能真正取消底层请求，而不是只丢弃结果。

### C. Sidebar / shared layout actions

对于 `createPortalSession`、`startCheckout` 这类点击触发请求：

1. 组件内持有当前 `AbortController`
2. 新点击触发前，若旧请求仍在进行，先 abort 旧请求
3. 仅允许最后一次点击对应的请求继续
4. 若请求被 abort：
   - 不弹错误 toast
   - 不改成 failed UI
5. 若请求成功并已开始 `window.location` / `window.open`：
   - 不再处理本组件内的额外状态回写

## Error Handling

### Abort handling

- AbortError 必须被显式识别
- 识别后直接静默结束，不进入：
  - error state
  - toast.error
  - retry UI

### Non-abort errors

- 继续沿用现有错误行为
- 包含：
  - API 非 2xx
  - 网络失败
  - 401 / 403
  - schema / payload 问题

## Detailed File Targets

### Shared

- `src\lib\api\client.ts`
- `src\lib\api\types.ts`

### Dashboard / analytics / subscription API helpers

- `src\features\dashboard\api\market-overview.ts`
- `src\features\analytics\api\analytics.ts`
- `src\features\subscription\api\billing.ts`

### Shared layout / sidebar / bootstrap / page callers

- `src\app\SessionBootstrap.tsx`
- `src\components\nav-user-authenticated.tsx`
- 其他实际持有读取请求的 page / hook / bootstrap 组件

## Compatibility

这次改动保持向下相容：

- `signal` 为可选参数
- 旧调用点在未接入前不会立即失效
- 本次只逐步把高价值调用点接上，不要求一口气重写所有 helper

## Testing Strategy

### Unit / integration expectations

1. **client**
   - 传入 `signal` 时能正确透传给 fetch
   - abort error 能被识别

2. **page / hook**
   - 卸载时调用 `abort()`
   - abort 后不会写 error state

3. **sidebar portal / checkout**
   - 连续点击时，前一次请求被中止
   - 只有最后一次请求结果会触发跳转

4. **regression**
   - 非 abort 错误仍维持原有提示
   - 正常成功流不变

## Rollout Order

1. 扩充 shared API client 与 request option type
2. 接入 subscription / billing helper（因为最直接影响 sidebar 与 Stripe 跳转）
3. 接入页面初始化读取最重的 hooks / bootstrap
4. 接入 React Query `queryFn`
5. 补齐 abort 相关测试

## Risks and Mitigations

### Risk 1: 把 abort 当成普通错误

**Mitigation**  
统一透过 `isAbortError()` 判定，所有调用点使用同一规则。

### Risk 2: 某些 helper 没接上 signal，导致行为不一致

**Mitigation**  
优先从 shared client 往外层逐层接，先覆盖高频与高影响路径。

### Risk 3: 外部跳转前状态竞态

**Mitigation**  
对 portal / checkout 前置请求只保留最后一次 controller，请求成功后立即执行跳转，不再做多余状态回写。

## Success Criteria

满足以下条件即可视为完成：

1. 页面快速切换时，上一页读取请求会被真实中止。
2. sidebar 中 portal / checkout 前置请求不会再拖慢后续点击动作。
3. 被 abort 的请求不会出现错误提示。
4. 正常请求与错误处理行为保持不变。
