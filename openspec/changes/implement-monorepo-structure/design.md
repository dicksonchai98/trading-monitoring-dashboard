## Context

目前 repo 尚未完成 monorepo 結構落地，前後端與 shared 模組的邊界未具體化，容易造成依賴擴散與後續維護成本上升。此設計將依據既有設計文件落實 `apps/` 與 `packages/` 分層，並定義最小 shared 套件。

## Goals / Non-Goals

**Goals:**
- 建立 `apps/frontend` 與 `apps/backend` 的部署單位結構。
- 建立 `packages/shared/contracts` 與 `packages/shared/config`。
- 文件化依賴方向與可見性規則（MVP 無自動檢查）。

**Non-Goals:**
- 不加入 lint/build 邊界檢查工具。
- 不引入新的 runtime 共享邏輯。
- 不改變前後端部署型態（仍可各自部署）。

## Decisions

1. **Monorepo 目錄分層採 `apps/` + `packages/`**
   - 前後端分別落在 `apps/frontend`、`apps/backend`。
   - shared 落在 `packages/shared/*`。
   - 理由：清楚分離部署單位與可重用模組，便於後續擴充。

2. **共享範圍最小化（contracts + config）**
   - 先定義事件/快照/角色等契約與環境變數 schema。
   - 理由：避免 shared 層肥大，保留擴充空間。

3. **共享為 build-time only**
   - 前後端各自產出部署 artifact，不做 runtime 共享。
   - 理由：符合分離部署模型，避免耦合。

## Risks / Trade-offs

- **[Risk]** 無工具檢查導致邊界被破壞 → **Mitigation**：先透過文件規範與 code review 執行，後續再補工具。
- **[Risk]** shared 模組成長失控 → **Mitigation**：嚴格限定 shared 內容，新增需先評估。

## Migration Plan

1. 建立新目錄結構與 README。
2. 新增 shared contracts/config 作為第一批共享模組。
3. 將既有前後端檔案逐步遷移到 `apps/` 下。
4. 確認 build/compose 設定可對應新路徑。

## Open Questions

- 邊界檢查工具何時導入（lint or build rule）？
- shared 是否需要再拆分層級（core/platform）？