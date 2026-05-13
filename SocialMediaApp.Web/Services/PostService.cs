using Microsoft.EntityFrameworkCore;
using SocialMediaApp.Web.Common;
using SocialMediaApp.Web.Data;
using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.Repositories.Interfaces;
using SocialMediaApp.Web.Services.Interfaces;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Services;

public class PostService(
    IPostRepository postRepository,
    ICommentRepository commentRepository,
    AppDbContext dbContext) : IPostService
{
    private readonly IPostRepository _postRepository = postRepository;
    private readonly ICommentRepository _commentRepository = commentRepository;
    private readonly AppDbContext _dbContext = dbContext;

    public Task<IReadOnlyList<Post>> GetFeedAsync(CancellationToken cancellationToken = default)
        => _postRepository.GetFeedAsync(cancellationToken);

    public async Task<Result<Post>> CreateAsync(int currentUserId, PostEditViewModel model, CancellationToken cancellationToken = default)
    {
        var post = new Post
        {
            UserId = currentUserId,
            Content = model.Content,
            CreatedAt = DateTime.UtcNow
        };

        var postId = await _postRepository.CreateAsync(post, cancellationToken);
        post.PostId = postId;
        return Result<Post>.Success(post);
    }

    public async Task<Result<Post>> GetEditablePostAsync(int postId, int currentUserId, CancellationToken cancellationToken = default)
    {
        var post = await _postRepository.GetByIdAsync(postId, cancellationToken);
        if (post is null || post.IsDeleted)
        {
            return Result<Post>.Failure("Post not found.");
        }

        if (post.UserId != currentUserId)
        {
            return Result<Post>.Failure("Unauthorized.");
        }

        return Result<Post>.Success(post);
    }

    public async Task<Result> UpdateAsync(int currentUserId, PostEditViewModel model, CancellationToken cancellationToken = default)
    {
        var postResult = await GetEditablePostAsync(model.PostId, currentUserId, cancellationToken);
        if (!postResult.IsSuccess || postResult.Value is null)
        {
            return Result.Failure(postResult.Error);
        }

        postResult.Value.Content = model.Content;
        postResult.Value.Image = null;
        await _postRepository.UpdateAsync(postResult.Value, cancellationToken);
        return Result.Success();
    }

    public async Task<Result> DeleteAsync(int postId, int currentUserId, CancellationToken cancellationToken = default)
    {
        var postResult = await GetEditablePostAsync(postId, currentUserId, cancellationToken);
        if (!postResult.IsSuccess || postResult.Value is null)
        {
            return Result.Failure(postResult.Error);
        }

        await using var tx = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            postResult.Value.IsDeleted = true;
            await _postRepository.UpdateAsync(postResult.Value, cancellationToken);
            await _commentRepository.SoftDeleteByPostIdAsync(postId, cancellationToken);

            await tx.CommitAsync(cancellationToken);
            return Result.Success();
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
