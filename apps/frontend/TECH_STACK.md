# Frontend Tech Stack 文件

本文件定義 `apps/frontend` 的前端技術選型、職責分工與實作準則。

## 1. 目標與範圍

本專案前端為 Futures Monitoring Dashboard MVP，需遵守以下邊界：

- 僅支援「近月台指期」監控畫面。
- 即時資料透過 SSE（每 1 秒）更新。
- JWT 驗證與角色存取控制：`admin` / `member` / `visitor`。
- 訂閱流程為 mock 狀態流（intent/pending/active）。
- 不擴充到支付串接、WebSocket、非 MVP 商品。

詳細契約以 `apps/frontend/AGENTS.md` 為準。

## 2. 技術棧總覽

- Framework: `React`
- UI System: `shadcn/ui`
- Language & Type Safety: `TypeScript`（strict mode + type guards）
- Server State / Data Fetching: `@tanstack/react-query`（React Query）
- Form Validation: `react-hook-form` + `zod`
- Global Client State: `zustand`

## 3. 技術分工原則

### React

- 負責頁面與元件組合、路由、版面切分。
- 以功能分層（feature-first）管理元件，避免超大型共用元件。

### shadcn/ui

- 作為基礎 UI 元件系統（button, card, dialog, form controls）。
- 統一設計語言與可重用樣式，保持操作資訊清晰（特別是行情與狀態提示）。

### TypeScript（型別判斷）

- 開啟 `strict`，以型別定義 API/SSE/Auth 模型。
- 用 type guards 判斷不可信資料（例如 SSE payload、JWT 解析結果）。
- 禁止 `any` 逃逸型別安全（必要時以 `unknown` + narrowing）。

範例：

```ts
export type UserRole = 'admin' | 'member' | 'visitor'

export interface SnapshotMessage {
  symbol: string
  price: number
  timestamp: string
}

export function isSnapshotMessage(input: unknown): input is SnapshotMessage {
  if (!input || typeof input !== 'object') return false
  const value = input as Record<string, unknown>
  return (
    typeof value.symbol === 'string' &&
    typeof value.price === 'number' &&
    typeof value.timestamp === 'string'
  )
}
```

### React Query

- 管理「伺服器狀態」：登入後 API 讀取、快取、重試、失效策略。
- `query` 用於讀取資源（profile, entitlement, snapshot fallback）。
- `mutation` 用於登入、登出、mock 訂閱狀態切換。
- SSE 事件到來時可用 `queryClient.setQueryData` 同步快取。

### React Hook Form + Zod

- 所有輸入表單（登入、訂閱意圖）採單一路徑驗證。
- `zod` 作 schema source of truth；`react-hook-form` 管控狀態與效能。

範例：

```ts
import { z } from 'zod'

export const loginSchema = z.object({
  user_id: z.string().min(3),
  password: z.string().min(8),
})

export type LoginFormValues = z.infer<typeof loginSchema>
```

註冊流程採兩步驟：

- Step 1: `email` 驗證（send OTP -> verify OTP）
- Step 2: `user_id + password` 建立帳號
- 註冊 API payload 以 `user_id`, `email`, `password`, `verification_token` 為準

### Zustand

- 管理「客戶端全域狀態」：
  - auth session（token、角色）
  - SSE connection status（connected/retrying/disconnected）
  - UI 偏好（必要時）
- 原則：
  - server truth 仍以 React Query 與後端為準
  - Zustand 不重複儲存可由 query cache 推導的資料

## 4. 推薦目錄結構

```txt
apps/frontend/
  src/
    app/                  # router, providers, app entry
    features/
      auth/
      dashboard/
      subscription/
    components/ui/        # shadcn/ui components
    lib/
      api/                # fetch client + query functions
      sse/                # event source adapters
      validation/         # zod schemas
      types/              # shared TS types + type guards
      store/              # zustand stores
```

## 5. 資料流與狀態責任

- API 請求：`React Query`
- 即時行情（SSE）：`EventSource` + adapter + 寫入 query cache
- 表單輸入與驗證：`RHF + Zod`
- 全域 app 狀態（非伺服器狀態）：`Zustand`

## 6. 實作規範（MVP）

- 路由守衛必須檢查角色與 entitlement：
  - `visitor`: 僅公開頁
  - `member`: 會員頁（需 active entitlement）
  - `admin`: 後台頁
- 明確處理 `401` / `403`，並提供可預期 UX（redirect + message）。
- SSE 必須提供連線狀態 UI：`connected` / `retrying` / `disconnected`。
- 高流量頁面（auth/dashboard/subscription）需提供 `PageSkeleton` 作為初始 loading/fallback，避免內容閃爍。
- 不在前端重算後端已提供的市場指標。

## 7. 測試建議（最低要求）

- Route guard：角色 + entitlement 單元測試。
- Auth/session：token 過期、`401` 行為測試。
- SSE：connect/message/reconnect/failure 整合型測試。
- UI：unauthorized/forbidden redirect 與受保護頁面渲染測試。

## 8. 套件建議版本策略

- React 19.x（若專案需穩定可固定 minor）
- TypeScript 5.x
- `@tanstack/react-query` 5.x
- `react-hook-form` 7.x
- `zod` 3.x 或 4.x（與既有相依版本一致）
- `zustand` 4.x 或 5.x（與 React 版本相容為準）
- `shadcn/ui` 依 CLI 生成版本與 Radix 相依鎖定

## 9. 非目標

- 真實金流支付串接
- WebSocket 即時改造
- 多市場、多商品監控
- 歷史回補與高階圖表分析

---

如需擴充（例如 i18n、權限矩陣細粒度、Error Boundary 策略），請先 `ask me` 再更新此文件。
