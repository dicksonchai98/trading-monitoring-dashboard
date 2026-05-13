using Microsoft.EntityFrameworkCore;
using SocialMediaApp.Web.Data;
using SocialMediaApp.Web.Entities;

namespace SocialMediaApp.Web.Tests;

public class DataModelTests
{
    [Fact]
    public void UserEntity_ShouldContainRequiredAndOptionalFields()
    {
        var user = new User();
        var type = user.GetType();

        Assert.NotNull(type.GetProperty(nameof(User.UserId)));
        Assert.NotNull(type.GetProperty(nameof(User.UserName)));
        Assert.NotNull(type.GetProperty(nameof(User.Email)));
        Assert.NotNull(type.GetProperty(nameof(User.PhoneNumber)));
        Assert.NotNull(type.GetProperty(nameof(User.PasswordHash)));
        Assert.NotNull(type.GetProperty("CoverImage"));
        Assert.NotNull(type.GetProperty("Biography"));
        Assert.NotNull(type.GetProperty("CreatedAt"));
    }

    [Fact]
    public void DbModel_ShouldDefineUniqueConstraintsForUserEmailAndPhoneNumber()
    {
        using var context = CreateContext();
        var entity = context.Model.FindEntityType(typeof(User));
        Assert.NotNull(entity);

        var indexes = entity!.GetIndexes().ToArray();
        Assert.Contains(indexes, index => index.IsUnique && index.Properties.Select(p => p.Name).SequenceEqual(new[] { "Email" }));
        Assert.Contains(indexes, index => index.IsUnique && index.Properties.Select(p => p.Name).SequenceEqual(new[] { "PhoneNumber" }));
    }

    [Fact]
    public void DbModel_ShouldDefinePostAndCommentRelationships()
    {
        using var context = CreateContext();

        var postEntity = context.Model.FindEntityType(typeof(Post));
        var commentEntity = context.Model.FindEntityType(typeof(Comment));
        Assert.NotNull(postEntity);
        Assert.NotNull(commentEntity);

        Assert.Contains(postEntity!.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(User));
        Assert.Contains(commentEntity!.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(User));
        Assert.Contains(commentEntity.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(Post));
        Assert.All(commentEntity.GetForeignKeys(), fk => Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior));
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        return new AppDbContext(options);
    }
}
