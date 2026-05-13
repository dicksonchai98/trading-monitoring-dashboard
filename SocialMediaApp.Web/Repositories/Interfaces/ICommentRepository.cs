using SocialMediaApp.Web.Entities;

namespace SocialMediaApp.Web.Repositories.Interfaces;

public interface ICommentRepository
{
    Task<Comment> CreateAsync(Comment comment, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Comment>> GetByPostIdAsync(int postId, CancellationToken cancellationToken = default);
    Task SoftDeleteByPostIdAsync(int postId, CancellationToken cancellationToken = default);
}
