## Why

現有設計需要落實 monorepo 結構與模組邊界規範，否則前後端與各 domain 的目錄與依賴將持續擴散，後續擴充與協作成本過高。現在先建立一致的工程骨架，才能支撐後續功能實作。

## What Changes

- 建立 `apps/frontend` 與 `apps/backend` 的 monorepo 目錄結構。
- 新增 `packages/shared/contracts` 與 `packages/shared/config` 的最小共享模組。
- 明確文件化依賴方向與可見性規則（MVP 先不加工具檢查）。

## Capabilities

### New Capabilities
- `monorepo-structure`: 定義 monorepo 目錄、shared 模組與依賴邊界規則的規格。

### Modified Capabilities
- （無）

## Impact

- 影響 repo 目錄結構與模組依賴規範。
- 影響前後端建置與部署流程（仍可各自部署）。