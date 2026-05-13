# Simple Social Media Platform Design

## 1. System Overview

本系統是一個簡易社群媒體平台，使用 ASP.NET Core MVC 實作 Server-side Rendering，提供註冊、登入、發文、留言、文章編輯與刪除功能。

系統採用三層式架構：

```text
Nginx
  ↓
ASP.NET Core MVC Application
  ↓
SQL Server / PostgreSQL
```

## 2. Tech Stack

| 類別 | 技術 |
|---|---|
| Web Server | Nginx |
| Application Server | ASP.NET Core MVC |
| Language | C# |
| ORM | EF Core (Code First for schema management) |
| Migration | EF Core Migration |
| Data Access | Stored Procedure + ADO.NET / EF Core Raw SQL |
| Database | SQL Server / PostgreSQL |
| Frontend UI | Razor View + Bootstrap |
| Container | Docker / Docker Compose |
| Authentication | Cookie Authentication |

## 3. Architecture

```text
Browser
  ↓
Nginx
  ↓
ASP.NET Core MVC
  ├── Controllers
  ├── Services
  ├── Repositories
  ├── ViewModels
  ├── Entities
  └── Common
      ↓
EF Core DbContext
      ↓
Database
```

## 4. Project Structure

```text
social-media-mvc/
├── SocialMediaApp.slnx
├── docs/
│   └── 2026-05-11-social-media-design.md
└── SocialMediaApp.Web/
    ├── Controllers/
    │   ├── AccountController.cs
    │   ├── PostsController.cs
    │   └── CommentsController.cs
    ├── Services/
    │   ├── Interfaces/
    │   ├── AccountService.cs
    │   ├── PostService.cs
    │   └── CommentService.cs
    ├── Repositories/
    │   ├── Interfaces/
    │   ├── UserRepository.cs
    │   ├── PostRepository.cs
    │   └── CommentRepository.cs
    ├── Data/
    │   ├── AppDbContext.cs
    │   └── Migrations/
    ├── Entities/
    │   ├── User.cs
    │   ├── Post.cs
    │   └── Comment.cs
    ├── ViewModels/
    │   ├── RegisterViewModel.cs
    │   ├── LoginViewModel.cs
    │   ├── PostViewModel.cs
    │   └── CommentViewModel.cs
    ├── Views/
    │   ├── Account/
    │   ├── Posts/
    │   └── Shared/
    ├── Common/
    │   ├── Result.cs
    │   └── Constants.cs
    ├── DB/
    │   ├── schema.sql
    │   ├── stored-procedures.sql
    │   ├── seed.sql
    │   └── sample-data.sql
    ├── appsettings.json
    ├── Program.cs
    └── SocialMediaApp.Web.csproj
```

## 5. Layer Responsibility

### 5.1 Presentation Layer

包含：

- Controllers
- Views
- ViewModels

負責接收 HTTP Request、回傳 Razor View、處理 Model Binding 與基本驗證。

Controller 不直接操作資料庫。

```text
Controller → Service → Repository → DbContext
```

### 5.2 Business Layer

包含：

- Services
- Service Interfaces

負責商業邏輯，例如：

- 註冊時檢查手機號碼是否重複
- 密碼雜湊
- 登入驗證
- 發文權限檢查
- 編輯 / 刪除文章時檢查是否為作者本人

### 5.3 Data Layer

包含：

- Repositories
- AppDbContext
- Entities
- EF Core Migration

負責資料存取，本設計使用 EF Core 管理資料表結構與 Migration。

### 5.4 Common Layer

包含：

- Result
- Constants
- Utility
- Exception Helper

負責放置共用物件與工具。

## 6. Database Design

### 6.1 Users

Users（題目最小必備欄位）

- UserId (PK)
- UserName
- Email
- PasswordHash
- CoverImage (Nullable)
- Biography (Nullable)

Users（本設計額外欄位）

- PhoneNumber（用於題目要求的手機註冊/登入）
- CreatedAt

注意：

- Email 必須唯一
- PhoneNumber 必須唯一
- Password 不可明文儲存

### 6.2 Posts

Posts（題目最小必備欄位）

- PostId (PK)
- UserId (FK -> Users.UserId)
- Content
- Image (Nullable)
- CreatedAt

### 6.3 Comments

Comments（題目最小必備欄位）

- CommentId (PK)
- UserId (FK -> Users.UserId)
- PostId (FK -> Posts.PostId)
- Content
- CreatedAt

### 6.4 Minimum SQL Schema (for DB/schema.sql)

```sql
CREATE TABLE Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    UserName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(512) NOT NULL,
    CoverImage NVARCHAR(500) NULL,
    Biography NVARCHAR(1000) NULL,
    PhoneNumber NVARCHAR(30) NOT NULL UNIQUE,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Posts (
    PostId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    Image NVARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Posts_Users FOREIGN KEY (UserId) REFERENCES Users(UserId)
);

CREATE TABLE Comments (
    CommentId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    PostId INT NOT NULL,
    Content NVARCHAR(2000) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Comments_Users FOREIGN KEY (UserId) REFERENCES Users(UserId),
    CONSTRAINT FK_Comments_Posts FOREIGN KEY (PostId) REFERENCES Posts(PostId)
);
```

## 7. EF Core Migration + Stored Procedure Design

本專案使用 EF Core Migration 管理 DDL，並使用 Stored Procedure 存取主要業務資料。

分工原則：

- EF Core Migration：管理資料表、索引、外鍵等結構變更（DDL）。
- Stored Procedure：處理註冊、登入查詢、發文 CRUD、留言新增與查詢等資料存取。
- Service 層僅呼叫 Repository；Repository 內統一呼叫 SP（避免業務程式散落 SQL）。

建立 Migration：

```bash
dotnet ef migrations add InitialCreate
```

更新資料庫：

```bash
dotnet ef database update
```

Docker 環境 Migration 策略：建議在 Application 啟動時自動執行 Migration。

```csharp
using var scope = app.Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
db.Database.Migrate();
```

注意：正式環境若多人部署，建議改成獨立 migration job，避免多個 container 同時執行 migration。

Stored Procedure 範例（以新增文章為例）：

```sql
CREATE PROCEDURE sp_Post_Create
    @UserId INT,
    @Content NVARCHAR(MAX),
    @Image NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Posts (UserId, Content, Image, CreatedAt)
    VALUES (@UserId, @Content, @Image, SYSUTCDATETIME());
END
```

## 8. Transaction Design

EF Core 的 `SaveChanges()` 預設會把同一次異動包在 transaction 中。

例如：

```csharp
post.IsDeleted = true;
comments.ForEach(x => x.IsDeleted = true);

await _dbContext.SaveChangesAsync();
```

若有跨多次 SaveChanges 或複雜操作，則明確使用 transaction：

```csharp
await using var transaction = await _dbContext.Database.BeginTransactionAsync();

try
{
    // update post
    // update comments

    await _dbContext.SaveChangesAsync();
    await transaction.CommitAsync();
}
catch
{
    await transaction.RollbackAsync();
    throw;
}
```

適用場景：

- 刪除文章時，同時處理文章與留言
- 註冊時，同時建立 User 與相關預設資料

## 9. Authentication Design

使用 Cookie Authentication。

登入成功後建立 Claims：

- UserId
- PhoneNumber
- DisplayName

需要登入的功能加上：

```csharp
[Authorize]
```

例如：

- 新增文章
- 編輯文章
- 刪除文章
- 新增留言

文章編輯與刪除除了登入外，還要檢查：

```csharp
Post.UserId == CurrentUserId
```

## 10. Security Design

### 10.1 SQL Injection

雖然使用 EF Core + Stored Procedure，仍需避免 raw SQL 字串拼接。

禁止：

```csharp
EXEC('SELECT * FROM Users WHERE Phone = ' + @phone)
```

建議：

```csharp
EXEC sp_User_GetByPhone @PhoneNumber = @phone
```

或使用參數化查詢（`SqlParameter`）。

### 10.2 XSS

Razor 預設會 HTML Encode。

安全：

```cshtml
@Model.Content
```

避免：

```cshtml
@Html.Raw(Model.Content)
```

發文與留言內容需要限制長度。

### 10.3 CSRF

所有 POST 表單都要加：

```cshtml
@Html.AntiForgeryToken()
```

Controller 加：

```csharp
[ValidateAntiForgeryToken]
```

### 10.4 Password Security

密碼不可明文儲存。

使用：

```csharp
PasswordHasher<User>
```

資料庫只保存：

```text
PasswordHash
```

## 11. Nginx Design

Nginx 作為 Web Server / Reverse Proxy。

```text
Client
  ↓
Nginx :80
  ↓
ASP.NET Core App :8080
```

`nginx/default.conf`：

```nginx
server {
    listen 80;

    location / {
        proxy_pass http://app:8080;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

ASP.NET Core 需要啟用 forwarded headers。

## 12. Docker Design

### 12.1 Services

- nginx
- app
- database

### 12.2 docker-compose.yml

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ASPNETCORE_URLS: http://+:8080
      ConnectionStrings__DefaultConnection: Server=db;Database=SocialMediaDb;User Id=sa;Password=Your_password123;TrustServerCertificate=True;
    depends_on:
      - db

  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      SA_PASSWORD: "Your_password123"
    ports:
      - "1433:1433"
    volumes:
      - db_data:/var/opt/mssql

volumes:
  db_data:
```

## 13. Dockerfile

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "SocialMediaApp.Web.dll"]
```

如果環境尚未支援 .NET 10，可改成：

- `mcr.microsoft.com/dotnet/sdk:8.0`
- `mcr.microsoft.com/dotnet/aspnet:8.0`

## 14. DB Folder Design

本專案保留 `DB` 資料夾，並提供題目要求的 DDL / DML / SP 腳本：

```text
DB/
├── schema.sql            # DDL: table/index/constraint
├── stored-procedures.sql # SP definition
├── README.md
├── seed.sql              # DML: initial data
└── sample-data.sql       # DML: test/demo data
```

`schema.sql` 可由 EF Core Migration 匯出產生，並交付固定版本供審查。

如需匯出 SQL：

```bash
dotnet ef migrations script -o DB/migration.sql
```

如需整理為題目交付格式，可再拆分為 `DB/schema.sql`。

## 15. Main User Flow

### Register

使用者輸入手機號碼、名稱、Email、密碼
→ Controller
→ AccountService 檢查手機與 Email 是否重複
→ PasswordHasher 產生 PasswordHash
→ UserRepository 呼叫 `sp_User_Create`
→ Redirect Login

### Login

使用者輸入手機號碼、密碼
→ 呼叫 `sp_User_GetByPhone`
→ 驗證 PasswordHash
→ 建立 Cookie
→ Redirect Posts Index

### Create Post

登入使用者輸入內容（可附圖片）
→ Controller 取得 CurrentUserId
→ PostService 建立文章
→ Repository 呼叫 `sp_Post_Create`

### Add Comment

登入使用者在文章下留言
→ Controller 取得 CurrentUserId
→ CommentService 檢查文章存在
→ Repository 呼叫 `sp_Comment_Create`

### Edit / Delete Post

登入使用者操作文章
→ PostService 查詢文章
→ 檢查文章作者是否為目前登入者
→ 通過才允許修改或刪除

## 16. Security & Risk Management

| Risk | Solution |
|---|---|
| Unauthenticated users creating posts/comments | Use `[Authorize]` attribute to restrict access |
| Users editing or deleting other users' posts | Validate `Post.UserId == CurrentUserId` in backend service |
| SQL Injection | Use parameterized Stored Procedure / SQL parameters. Avoid string concatenation SQL |
| XSS (Cross-Site Scripting) | Razor default HTML encoding. Avoid `Html.Raw()` |
| CSRF (Cross-Site Request Forgery) | Use `@Html.AntiForgeryToken()` and `[ValidateAntiForgeryToken]` |
| Password leakage | Store only `PasswordHash`, never plaintext password |
| Duplicate account registration | Add unique constraint on `PhoneNumber` and `Email`, and validate before registration |
| Weak password security | Enforce minimum password length and complexity validation |
| Unauthorized access to hidden pages | Backend authorization validation, not frontend only |
| Mass assignment attack | Use ViewModel instead of directly binding Entity |
| Database migration failure | Add retry mechanism and migration validation on startup |
| Multiple containers running migration simultaneously | Use dedicated migration job in production |
| Sensitive configuration leakage | Store connection strings in environment variables |
| Container startup order issue | Use `depends_on` and health checks in Docker Compose |
| Database inconsistency during multi-table update | Use EF Core Transaction (`BeginTransactionAsync`) |
| Soft-deleted data still visible | Always filter `IsDeleted == false` |
| Brute-force login attempts | Add login retry limit / lock mechanism (optional MVP) |
| Session hijacking | Configure secure cookie settings (`HttpOnly`, `Secure`, `SameSite`) |

### 16.1 Authorization Strategy

The system uses role-independent ownership validation.

Authentication alone is insufficient.

For update/delete operations:

```text
Only the creator of the post can edit or delete it.
```

Backend validation example:

```csharp
if (post.UserId != currentUserId)
{
    throw new UnauthorizedAccessException();
}
```

### 16.2 Password Security

Passwords are never stored in plaintext.

Implementation:

```csharp
PasswordHasher<User>
```

Stored value:

```text
PasswordHash
```

### 16.3 CSRF Protection

All POST forms must include:

```cshtml
@Html.AntiForgeryToken()
```

Controller validation:

```csharp
[ValidateAntiForgeryToken]
```

### 16.4 XSS Protection

Safe:

```cshtml
@Model.Content
```

Unsafe:

```cshtml
@Html.Raw(Model.Content)
```

User-generated content (post/comment) must always use Razor HTML encoding.

### 16.5 Transaction Strategy

For operations affecting multiple tables.

Example:

```text
Delete Post
→ Update Post.IsDeleted
→ Update Related Comments.IsDeleted
```

Use transaction:

```csharp
await using var transaction =
    await _db.Database.BeginTransactionAsync();
```

Rollback if any operation fails.

## 17. Deployment Flow

```bash
docker compose build
docker compose up -d
```

啟動後流程：

- Nginx 啟動
- ASP.NET Core App 啟動
- App 連線 DB
- EF Core Migration 自動執行
- 使用者透過 `http://localhost` 存取系統

## 18. Conclusion

本系統採用 ASP.NET Core MVC + EF Core Migration + Stored Procedure + Nginx + Docker 的方式實作。

整體設計符合：

- 三層式架構
- MVC Server-side Rendering
- Cookie Authentication
- Bootstrap RWD
- EF Core Migration
- Stored Procedure Data Access
- Transaction
- Dockerized Deployment
- Nginx Reverse Proxy
- 基本資安防護
