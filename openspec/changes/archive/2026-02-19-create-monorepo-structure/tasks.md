## 1. Monorepo Structure Setup

- [ ] 1.1 建立頂層目錄 `apps/` 與 `packages/`
- [ ] 1.2 建立 `apps/<domain>` 與 `packages/shared/*` 的範例結構與 README
- [ ] 1.3 定義並記錄 domain 與 shared 的依賴方向規則

## 2. Module Boundary Rules

- [ ] 2.1 明確化 shared 模組命名規範與用途範圍
- [ ] 2.2 定義 app/shared 的 public entry 入口規範（如 index.ts）
- [ ] 2.3 補充範例：如何從 app 使用 shared 模組

## 3. Enforcement & Validation

- [ ] 3.1 評估並選定依賴邊界檢查方式（lint/build 規則或工具）
- [ ] 3.2 如果採用工具，加入最小可行的邊界檢查設定
- [ ] 3.3 撰寫驗收檢查清單，對照 spec requirements