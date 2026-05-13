## Context

本變更要把「簡易社群媒體平台」從高層設計轉成可實作的工程設計，目標系統為 ASP.NET Core MVC（SSR）應用，經 Nginx 反向代理，資料庫採 SQL Server 或 PostgreSQL。現況已有 proposal 定義能力範圍（auth、post/comment、資料模型、安全與部署），但仍需要明確的落地決策，特別是：

- 三層架構責任邊界與目錄對應（Controller/Service/Repository/DbContext）
- EF Core Migration 與 Stored Procedure 的分工
- 認證授權與資安防護在 MVC request pipeline 的落點
- Docker + Nginx 的部署與 migration 執行策略

關鍵限制與利害關係：
- 需符合文件要求的功能完整性（註冊、登入、發文、刪文、留言，以及作者權限檢查）。
- 需確保資料一致性與可維運（transaction、migration、回滾策略）。
- 需在 MVP 階段優先可交付，避免過度設計。

## Goals / Non-Goals

**Goals:**
- 建立可直接對應實作的架構與分層規範，避免跨層耦合。
- 定義 Users/Posts/Comments 資料模型、唯一鍵與關聯約束，並以 migration 版本化。
- 定義主要業務操作的資料存取路徑（Repository 統一進出 SP/參數化 SQL）。
- 建立一致的認證授權與安全控制（Cookie、Authorize、CSRF、XSS、SQL injection 防護）。
- 建立容器化部署流程，確保本地與測試環境可重現。
- 以 Bootstrap 建立具備 RWD 的 Razor UI，確保桌機與行動裝置可用性。
- 明確列出可執行的 migration/rollback 策略與風險緩解。

**Non-Goals:**
- 非本次範圍：按讚、追蹤、通知、私訊、全文搜尋、檔案物件儲存服務整合。
- 不建立複雜 RBAC/ABAC；本次授權以「登入 + 資源擁有權」為主。
- 不在本次導入多區域高可用與完整零停機升級方案。

## Decisions

1. 採用 ASP.NET Core MVC + Razor（SSR）作為 UI 與請求處理層  
   - Rationale: 與需求文件一致，開發速度快、表單驗證與 AntiForgery 整合成熟。  
   - Alternatives considered: SPA + Web API。雖可提升前後端分離彈性，但超出本次 MVP 複雜度與交付目標。

2. 分層固定為 Controller → Service → Repository → DbContext  
   - Rationale: 把 HTTP 邏輯、業務規則、資料存取分離，利於測試與維護。  
   - Alternatives considered: Controller 直接呼叫 DbContext。雖開發較快，但會讓授權與交易規則分散、難一致治理。

3. EF Core Migration 管理 DDL；業務資料存取以 SP/參數化 SQL 為主  
   - Rationale: migration 提供 schema 演進可追蹤性；SP 可集中查詢/寫入路徑，降低 SQL 散落與注入風險。  
   - Alternatives considered: 全 EF LINQ 或全手寫 SQL。前者在既有 SP 規範下不一致；後者失去 migration 與模型一致性優勢。

4. 認證使用 Cookie Authentication，授權採 [Authorize] + 作者擁有權檢查  
   - Rationale: MVC SSR 對 Cookie 流程天然適配；資源操作以 `Post.UserId == CurrentUserId` 作為核心授權規則。  
   - Alternatives considered: JWT。較適合純 API/跨端情境，對目前 SSR 場景收益有限且增加 token 管理成本。

5. 安全基線強制化  
   - Rationale: 所有 POST 表單須 AntiForgery、預設 Razor encode、禁止 SQL 字串拼接、密碼只存 Hash、ViewModel 綁定避免 Mass assignment。  
   - Alternatives considered: 僅依賴框架預設。會留下實作偏差空間，故改為規格強制。

6. 刪文與關聯留言更新採 transaction 保證一致性  
   - Rationale: 涉及多表或多步驟更新時，需顯式 transaction 以避免部分成功。  
   - Alternatives considered: 最終一致性補償。MVP 階段複雜度較高，先採同步交易一致性。

7. 部署採 Docker Compose 三服務（nginx/app/db），Nginx 為 reverse proxy  
   - Rationale: 本地/測試可快速重現拓撲；Nginx 統一入口與 forwarded headers。  
   - Alternatives considered: 直接 Kestrel 對外。雖簡化部署，但不符合目標架構。

8. Migration 策略：開發環境允許啟動自動 migrate；正式環境建議獨立 migration job  
   - Rationale: 開發便利與正式穩定性兼顧，避免多容器同時 migrate。  
   - Alternatives considered: 所有環境都啟動自動 migrate。正式環境風險較高。

9. 首版資料庫以 SQL Server 為主目標，PostgreSQL 列為後續擴充  
   - Rationale: 既有 compose 與腳本以 MSSQL 為中心，先收斂單一目標可降低首版交付風險。  
   - Alternatives considered: 首版同時支援 SQL Server/PostgreSQL。可行但增加 migration/SP 方言維護成本。

10. 貼文刪除採 soft delete（`IsDeleted`）並強制查詢過濾  
   - Rationale: 與風險管理一致，可降低誤刪不可回復風險，並保留審計與回復空間。  
   - Alternatives considered: hard delete。實作較簡單，但資料可追溯性與誤刪風險較差。

## Risks / Trade-offs

- [多容器併發執行 migration 導致衝突] → 正式環境改獨立 migration job，app 啟動前完成 schema 升級。
- [Stored Procedure 與 Entity/Model 演進不同步] → 在 CI 加入 migration + SP 檢查清單，變更需同步更新 `DB/stored-procedures.sql`。
- [授權檢查只做在 Controller 容易遺漏] → 擁有權檢查下沉至 Service 層，Controller 僅轉送 currentUserId。
- [Soft delete 資料外洩] → Repository 查詢預設加 `IsDeleted == false`（若採 soft delete）。
- [CSRF/XSS 實作不一致] → 以基底表單/helper 與 code review checklist 強制檢查。
- [SQL Server / PostgreSQL 方言差異] → SP 與 migration 腳本按目標資料庫維護對應版本，避免跨方言混用。
- [Compose 啟動順序導致 app 先於 db 啟動失敗] → 為 `app`/`db` 設定 healthcheck 與啟動條件，並加上重試策略。
- [Cookie 安全設定不足造成 session 風險] → 強制 `HttpOnly`、`Secure`（HTTPS）、`SameSite` 與合理過期策略。

## Migration Plan

1. 建立初始 migration（Users/Posts/Comments、索引、外鍵、唯一鍵）。
2. 產出並審查 SQL 交付物：`DB/schema.sql`、`DB/migration.sql`（必要時拆分）。
3. 建置 Stored Procedures：`sp_User_Create`、`sp_User_GetByPhone`、`sp_Post_Create`、`sp_Comment_Create` 與必要查詢/更新 SP。
4. 實作 Repository 對 SP/參數化查詢呼叫，Service 補齊驗證與授權。
5. 啟用 Cookie Authentication、Authorize policy、AntiForgery、forwarded headers。
6. 以 Docker Compose 啟動 `db -> app -> nginx`，完成基本 smoke test（註冊/登入/發文/留言/刪文授權）。

Rollback strategy:
- 應用回滾：回退到前一版映像。
- 資料庫回滾：使用對應 down migration 或預先產生的回滾腳本；若有破壞性 DDL，先做備份再執行。
- 若 migration 已前進但應用回退，需確認舊版對新 schema 相容性；不相容則同步回滾 DB。

## Open Questions

- DB 是否在首版後立即擴充 PostgreSQL 相容，或先維持 SQL Server single-target？
- 登入防爆破（retry limit/lock）要在 MVP 必做還是列為次階段？
- 圖片欄位目前為 URL 字串，是否需要同階段納入檔案上傳與儲存策略？
