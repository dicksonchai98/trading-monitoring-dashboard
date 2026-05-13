using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SocialMediaApp.Web.Data;
using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.Repositories.Interfaces;
using SocialMediaApp.Web.Services;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Tests;

public class PostServiceTransactionTests
{
    [Fact]
    public async Task DeleteAsync_ShouldRollbackWhenCommentDeleteFails()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;

        await using var context = new AppDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var user = new User { UserName = "u", Email = "u@x.com", PhoneNumber = "123", PasswordHash = "hash" };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var post = new Post { UserId = user.UserId, Content = "hello" };
        context.Posts.Add(post);
        await context.SaveChangesAsync();

        var service = new PostService(new TestPostRepository(context), new FailingCommentRepository(), context);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteAsync(post.PostId, user.UserId));

        await using var verifyContext = new AppDbContext(options);
        var reloaded = await verifyContext.Posts.IgnoreQueryFilters().FirstAsync(x => x.PostId == post.PostId);
        Assert.False(reloaded.IsDeleted);
    }

    private sealed class TestPostRepository(AppDbContext context) : IPostRepository
    {
        public async Task<IReadOnlyList<Post>> GetFeedAsync(CancellationToken cancellationToken = default)
            => await context.Posts.AsNoTracking().ToListAsync(cancellationToken);

        public Task<Post?> GetByIdAsync(int postId, CancellationToken cancellationToken = default)
            => context.Posts.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.PostId == postId, cancellationToken)!;

        public Task<int> CreateAsync(Post post, CancellationToken cancellationToken = default) => throw new NotImplementedException();

        public async Task UpdateAsync(Post post, CancellationToken cancellationToken = default)
        {
            context.Posts.Update(post);
            await context.SaveChangesAsync(cancellationToken);
        }
    }

    private sealed class FailingCommentRepository : ICommentRepository
    {
        public Task<Comment> CreateAsync(Comment comment, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<Comment>> GetByPostIdAsync(int postId, CancellationToken cancellationToken = default) => throw new NotImplementedException();

        public Task SoftDeleteByPostIdAsync(int postId, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("boom");
    }
}
