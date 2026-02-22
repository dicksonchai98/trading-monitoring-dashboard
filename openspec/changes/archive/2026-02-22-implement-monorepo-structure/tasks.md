## 1. Monorepo Structure Setup

- [x] 1.1 建立 `apps/frontend` 與 `apps/backend` 目錄
- [x] 1.2 建立 `packages/shared/contracts` 與 `packages/shared/config` 目錄
- [x] 1.3 補上 README/說明文件描述目錄用途

## 2. Boundary Rules Documentation

- [x] 2.1 撰寫依賴方向規則（apps 可依賴 shared，shared 不可依賴 apps）
- [x] 2.2 說明 shared 為 build-time only 的限制

## 3. Infra Alignment

- [x] 3.1 更新 compose 或 env 模板以符合新路徑
- [x] 3.2 確認前後端 build 腳本仍可運作

## 4. Verification

- [x] 4.1 檢查前後端能使用 shared/contracts 編譯
- [x] 4.2 驗證 SSE 基本連線流程不受結構調整影響