using SocialMediaApp.Web.Repositories.Interfaces;
using SocialMediaApp.Web.Services;
using SocialMediaApp.Web.ViewModels;
using SocialMediaApp.Web.Entities;
using Microsoft.EntityFrameworkCore;

namespace SocialMediaApp.Web.Tests;

public class DomainGuardTests
{
    [Fact]
    public async Task CommentService_ShouldRejectMissingPost()
    {
        var service = new CommentService(new StubCommentRepository(), new StubPostRepository(null));
        var result = await service.CreateAsync(1, new CommentCreateViewModel { PostId = 99, Content = "x" });
        Assert.False(result.IsSuccess);
    }

    [Fact]
    public async Task PostService_ShouldRejectNonOwnerEdit()
    {
        var post = new Post { PostId = 1, UserId = 123, Content = "a" };
        var service = new PostService(new StubPostRepository(post), new StubCommentRepository(), new SocialMediaApp.Web.Data.AppDbContext(new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<SocialMediaApp.Web.Data.AppDbContext>().UseInMemoryDatabase("guards").Options));
        var result = await service.GetEditablePostAsync(1, 999);
        Assert.False(result.IsSuccess);
    }

    private sealed class StubPostRepository(Post? post) : IPostRepository
    {
        public Task<IReadOnlyList<Post>> GetFeedAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Post>>(post is null ? [] : [post]);
        public Task<Post?> GetByIdAsync(int postId, CancellationToken cancellationToken = default)
            => Task.FromResult(post);
        public Task<int> CreateAsync(Post post, CancellationToken cancellationToken = default) => Task.FromResult(1);
        public Task UpdateAsync(Post post, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class StubCommentRepository : ICommentRepository
    {
        public Task<Comment> CreateAsync(Comment comment, CancellationToken cancellationToken = default) => Task.FromResult(comment);
        public Task<IReadOnlyList<Comment>> GetByPostIdAsync(int postId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Comment>>([]);
        public Task<IReadOnlyList<Comment>> GetByPostIdsAsync(IReadOnlyCollection<int> postIds, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Comment>>([]);
        public Task SoftDeleteByPostIdAsync(int postId, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
