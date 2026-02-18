# PRD 拆分與依賴排序設計

- 日期: 2026-02-18
- 主題: 依 domain 重寫 PRD 並加入依賴與執行順序

## 目標
將期貨監控平台 PRD 依 domain 重寫為中文版本，並在 master 與各 domain PRD 明確標示依賴關係與建議執行順序，以降低協作與落地成本。

## 設計範圍
1. 重寫 `docs/prd/2026-02-16-futures-dashboard-master-prd.md` 為中文。
2. 重寫 `docs/prd/domains/01-06` 六份 domain PRD 為中文。
3. 新增固定欄位: 依賴清單、執行順序。
4. 強調「共同基礎依賴 (Platform/Infra)」作為所有 domain 的前置條件。

## 依賴排序原則
- 以 domain 之間的技術依賴為主。
- 共同基礎依賴先行，Identity & Access 優先，其他 domain 依其依賴排列。

建議順序:
1. Identity & Access
2. Subscription & Billing (Mock)
3. Admin & Audit
4. Market Data Ingestion
5. Indicator & Realtime
6. Historical Analytics (Post-MVP)

## 共通結構調整
每份 domain PRD 增加:
- 依賴清單: 標示共同基礎依賴與跨 domain 依賴。
- 執行順序: 依 master 的排序說明。

## 影響與風險
- 影響: PRD 內容更一致，依賴更清楚。
- 風險: 既有英文內容被替換為中文，若需雙語需額外維護。

## 驗收
- Master 與各 domain PRD 具備一致的依賴與順序描述。
- 六份 domain PRD 皆完成中文化與欄位一致性。
