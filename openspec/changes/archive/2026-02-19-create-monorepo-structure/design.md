## Context

目前專案尚未建立一致的 monorepo 結構與模組邊界規範，導致不同 domain 在目錄與依賴方向上容易擴散。此設計要提供一個可擴充、可維護的基礎骨架，讓後續各 domain 能在一致的邊界下落地。

## Goals / Non-Goals

**Goals:**
- 定義清楚的頂層目錄結構與服務/套件分層。
- 建立 domain 與 shared 模組的依賴方向與可見性規則。
- 提供可被後續實作與驗收引用的規範文件。

**Non-Goals:**
- 不涵蓋雲端部署與 IaC。
- 不引入進階監控或 tracing 架構。
- 不處理資料庫高可用或跨區備援設計。

## Decisions

1. **Monorepo 目錄分層**
   - 頂層以 `apps/`（可執行服務）與 `packages/`（共用模組）分離。
   - 各 domain 服務放在 `apps/<domain>`，共用模組放在 `packages/shared/*`。
   - 理由：清楚區隔部署單位與可重用邏輯，降低跨域耦合。

2. **依賴方向約束**
   - `apps/*` 可依賴 `packages/shared/*`，但 shared 不可依賴 app。
   - domain 之間禁止直接相依；若需共享能力，抽到 `packages/shared`。
   - 理由：避免 domain 彼此耦合，保持可替換性與邊界清晰。

3. **模組可見性規範**
   - shared 模組以「用途域」命名（如 `shared/config`, `shared/logging`）。
   - domain 模組僅暴露必要的入口（index / public API）。
   - 理由：讓依賴關係可稽核，避免隱性耦合。

## Risks / Trade-offs

- **[Risk]** 過度抽象 shared 導致共享層肥大 → **Mitigation**：shared 僅容納明確跨域需求，其他留在 domain。
- **[Risk]** 嚴格邊界造成短期開發摩擦 → **Mitigation**：提供明確規範與範例路徑，降低使用成本。

## Migration Plan

- 先建立目錄結構與規範文件。
- 新功能一律依規範落地。
- 既有或未來新增的 domain 逐步遷移到新結構。
- 如有不適用情境，先以提案方式修訂規範後再調整。

## Open Questions

- 是否需要在 lint 或 build 流程中加入「跨 domain 依賴禁止」檢查？
- shared 模組邊界是否需要細分成 core / platform / domain-shared 類型？