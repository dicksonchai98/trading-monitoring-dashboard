# Domain PRD: Identity & Access

- Domain: Identity & Access
- 版本: v1.0
- 日期: 2026-02-16
- 上層: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain 目標
提供 JWT 認證與 RBAC 權限檢查，作為所有受保護 API 的唯一授權來源。

## 2. 範圍 (MVP)
### 2.1 內含
1. JWT 登入與驗證。
2. RBAC policy 評估。
3. 角色/權限存取控制。
4. 前後端一致的授權結果。

### 2.2 不含
1. 多因子驗證。
2. OAuth 第三方登入。
3. 複雜組織/多租戶權限。

## 3. 依賴清單
1. 共同基礎依賴: PostgreSQL、環境變數、基本可觀測性。
2. 可選整合: `05-admin-audit` 用於安全事件記錄。

## 4. 輸出與介面
1. API
- `POST /auth/login`

2. JWT Claims
- `sub`, `role`, `exp`

3. RBAC policy
- `role-resource-action` 評估矩陣。

## 5. 處理規則
1. 驗證失敗需回 401/403 並記錄事件。
2. 後端授權為真實權限來源。
3. 前端 route guard 僅為 UX。

## 6. 失敗模式
1. JWT 失效或竄改
- 行動: 拒絕並記錄。

2. 權限矩陣缺漏
- 行動: 預設拒絕並告警。

## 7. 可觀測性
1. 登入成功/失敗次數。
2. 權限拒絕比例。
3. JWT 驗證錯誤。

## 8. 測試情境
1. 登入取得 JWT。
2. 權限不足被拒絕。
3. RBAC 矩陣覆蓋度測試。

## 9. 執行順序 (依賴排序)
1. 在共同基礎依賴完成後優先實作。
2. 需早於 `04-subscription-billing`、`05-admin-audit`、`02-indicator-realtime`。

## 10. 驗收標準
1. 所有受保護 API 皆受 RBAC 控制。
2. 未授權請求正確回應 401/403。
3. 安全事件可被追蹤。
