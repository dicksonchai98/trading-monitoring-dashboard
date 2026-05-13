INSERT INTO Posts (UserId, Content, Image, CreatedAt, IsDeleted)
VALUES (1, N'Welcome to SocialMediaApp!', NULL, SYSUTCDATETIME(), 0);

INSERT INTO Comments (UserId, PostId, Content, CreatedAt, IsDeleted)
VALUES (1, 1, N'First comment sample', SYSUTCDATETIME(), 0);
