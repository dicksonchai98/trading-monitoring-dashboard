## Why

現有專案尚未形成可落地的社群平台變更規格，導致登入/註冊、貼文與留言、資料存取策略、安全與部署規範缺乏一致契約。現在建立此 change 是為了把設計文件中的完整需求收斂為 OpenSpec artifact，作為後續設計、規格與任務分解的單一依據。

## What Changes

- 新增 ASP.NET Core MVC（SSR）社群平台能力：註冊、登入、建立貼文、編輯貼文、刪除貼文、新增留言。
- 明確分層與責任邊界：Controller → Service → Repository → DbContext，Controller 不直接存取資料庫。
- 建立資料模型與約束：Users、Posts、Comments 三表，含主外鍵、唯一鍵（Email、PhoneNumber）與不可明文密碼儲存。
- 定義資料存取策略：EF Core Migration 管理 DDL；Stored Procedure/參數化查詢處理主要業務資料存取。
- 補齊交易一致性規範：跨多次 SaveChanges 或多表更新（如刪文連帶留言）需顯式 transaction。
- 建立認證與授權規則：Cookie Authentication、[Authorize]、作者本人才能編輯/刪除文章。
- 建立安全基線：防 SQL Injection、XSS、CSRF、密碼雜湊、Mass assignment 防護、Session cookie 安全設定。
- 明確 UI 響應式要求：以 Razor + Bootstrap 提供 RWD 頁面體驗。
- 建立容器化與反向代理部署規格：Docker/Docker Compose 三服務（nginx/app/db）、Nginx reverse proxy、forwarded headers。
- 首版資料庫目標固定為 SQL Server（PostgreSQL 作為後續擴充路線）。
- 定義 Migration 與營運風險策略：啟動自動 migration（開發/單節點）、正式環境建議獨立 migration job 避免併發執行。
- 建立 DB 交付物規範：`DB/schema.sql`、`DB/stored-procedures.sql`、`DB/seed.sql`、`DB/sample-data.sql`、`DB/README.md` 與版本化輸出流程。

## Capabilities

### New Capabilities
- `user-auth`: 使用手機/Email 註冊與手機登入，密碼以 `PasswordHasher<User>` 雜湊，登入後發放 Cookie Claims（UserId、PhoneNumber、DisplayName）。
- `post-management`: 已登入使用者可建立貼文（可附圖）、編輯貼文、刪除貼文；編輯/刪除須通過作者擁有權檢查。
- `comment-management`: 已登入使用者可在貼文下新增留言，且需驗證目標貼文存在。
- `social-data-model`: 建立 Users/Posts/Comments 最小必備欄位與設計追加欄位，含唯一鍵、外鍵與時間戳預設值。
- `soft-delete-policy`: 建立貼文與留言 soft delete 規範與預設查詢過濾策略。
- `data-access-pattern`: 採用 EF Core Migration 管理 schema，Repository 層統一呼叫 Stored Procedure/參數化 SQL，避免業務 SQL 外散。
- `security-baseline`: 建立 SQL Injection、XSS、CSRF、密碼安全、ViewModel 綁定、登入嘗試限制與安全 Cookie 設定等防護規範。
- `containerized-deployment`: 提供 Dockerfile、docker-compose、Nginx reverse proxy 與 forwarded headers 設定，支援本地容器化部署流程。
- `transaction-consistency`: 明確多表/多步驟資料更新需使用顯式 transaction，失敗回滾以維持一致性。

### Modified Capabilities
- 無（目前 `openspec/specs/` 尚無既有 capability 需要 delta 修改）

## Impact

- Affected Code:
  - `SocialMediaApp.Web/Controllers/*`（Account/Posts/Comments）
  - `SocialMediaApp.Web/Services/*` 與 `Services/Interfaces/*`
  - `SocialMediaApp.Web/Repositories/*` 與 `Repositories/Interfaces/*`
  - `SocialMediaApp.Web/Data/AppDbContext.cs`、`Data/Migrations/*`
  - `SocialMediaApp.Web/Entities/*`、`ViewModels/*`、`Views/*`、`Common/*`
  - `SocialMediaApp.Web/Program.cs`（auth、forwarded headers、migration 策略）
- Database & Scripts:
  - `SocialMediaApp.Web/DB/schema.sql`
  - `SocialMediaApp.Web/DB/stored-procedures.sql`
  - `SocialMediaApp.Web/DB/seed.sql`
  - `SocialMediaApp.Web/DB/sample-data.sql`
- Infrastructure & Deployment:
  - `Dockerfile`
  - `docker-compose.yml`
  - `nginx/default.conf`
- APIs/Behavior:
  - 認證後能力限制與授權策略（作者擁有權）會直接影響所有貼文/留言寫入與修改路徑。
  - Migration 與部署流程需納入環境分流（開發自動 migration，正式環境獨立 job）。
- Dependencies:
  - ASP.NET Core MVC、EF Core、Authentication middleware、SQL Server/PostgreSQL driver、Nginx、Docker。
