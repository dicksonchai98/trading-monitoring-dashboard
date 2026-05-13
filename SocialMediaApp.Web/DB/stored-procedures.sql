CREATE OR ALTER PROCEDURE sp_User_ExistsByPhoneOrEmail
    @PhoneNumber NVARCHAR(30),
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT COUNT(1)
    FROM Users
    WHERE PhoneNumber = @PhoneNumber OR Email = @Email;
END
GO

CREATE OR ALTER PROCEDURE sp_User_Create
    @UserName NVARCHAR(100),
    @Email NVARCHAR(255),
    @PhoneNumber NVARCHAR(30),
    @PasswordHash NVARCHAR(512)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Users (UserName, Email, PhoneNumber, PasswordHash, CreatedAt)
    VALUES (@UserName, @Email, @PhoneNumber, @PasswordHash, SYSUTCDATETIME());

    SELECT CAST(SCOPE_IDENTITY() AS INT);
END
GO

CREATE OR ALTER PROCEDURE sp_User_GetByPhone
    @PhoneNumber NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1 UserId, UserName, Email, PasswordHash, CoverImage, Biography, PhoneNumber, CreatedAt
    FROM Users
    WHERE PhoneNumber = @PhoneNumber;
END
GO

CREATE OR ALTER PROCEDURE sp_Post_Create
    @UserId INT,
    @Content NVARCHAR(MAX),
    @Image NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Posts (UserId, Content, Image, CreatedAt, IsDeleted)
    VALUES (@UserId, @Content, @Image, SYSUTCDATETIME(), 0);

    SELECT CAST(SCOPE_IDENTITY() AS INT);
END
GO

CREATE OR ALTER PROCEDURE sp_Comment_Create
    @UserId INT,
    @PostId INT,
    @Content NVARCHAR(2000)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Comments (UserId, PostId, Content, CreatedAt, IsDeleted)
    VALUES (@UserId, @PostId, @Content, SYSUTCDATETIME(), 0);

    SELECT CAST(SCOPE_IDENTITY() AS INT);
END
GO
