using SocialMediaApp.Web.Common;
using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.Repositories.Interfaces;
using SocialMediaApp.Web.Services.Interfaces;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Services;

public class CommentService(
    ICommentRepository commentRepository,
    IPostRepository postRepository) : ICommentService
{
    private readonly ICommentRepository _commentRepository = commentRepository;
    private readonly IPostRepository _postRepository = postRepository;

    public async Task<Result<Comment>> CreateAsync(int currentUserId, CommentCreateViewModel model, CancellationToken cancellationToken = default)
    {
        var post = await _postRepository.GetByIdAsync(model.PostId, cancellationToken);
        if (post is null || post.IsDeleted)
        {
            return Result<Comment>.Failure("Post not found.");
        }

        var comment = new Comment
        {
            PostId = model.PostId,
            UserId = currentUserId,
            Content = model.Content,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _commentRepository.CreateAsync(comment, cancellationToken);
        return Result<Comment>.Success(created);
    }

    public Task<IReadOnlyList<Comment>> GetByPostIdAsync(int postId, CancellationToken cancellationToken = default)
        => _commentRepository.GetByPostIdAsync(postId, cancellationToken);

    public Task<IReadOnlyList<Comment>> GetByPostIdsAsync(IReadOnlyCollection<int> postIds, CancellationToken cancellationToken = default)
        => _commentRepository.GetByPostIdsAsync(postIds, cancellationToken);
}
