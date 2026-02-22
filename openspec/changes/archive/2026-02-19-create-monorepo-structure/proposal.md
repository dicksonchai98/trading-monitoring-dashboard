## Why

目前缺少明確的 monorepo 結構與模組邊界規範，導致前後端與各 domain 在檔案佈局與依賴關係上容易擴散，未來擴充與協作成本偏高。此變更要先建立一致的工程骨架，作為後續所有 domain 的共同基礎。

## What Changes

- 定義 monorepo 的頂層目錄結構與服務/套件邊界規則。
- 明確化 domain 與 shared 模組的依賴方向與可見性。
- 補上基礎的規範文件與約束清單，作為後續實作依據。

## Capabilities

### New Capabilities
- `monorepo-structure`: 定義專案頂層目錄、服務模組、shared 模組與依賴邊界規則的規格。

### Modified Capabilities
- （無）

## Impact

- 影響 repo 目錄結構與模組依賴規範文件。
- 影響後續 domain 的落地方式與結構一致性。