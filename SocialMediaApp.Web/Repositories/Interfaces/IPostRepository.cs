using SocialMediaApp.Web.Entities;

namespace SocialMediaApp.Web.Repositories.Interfaces;

public interface IPostRepository
{
    Task<IReadOnlyList<Post>> GetFeedAsync(CancellationToken cancellationToken = default);
    Task<Post?> GetByIdAsync(int postId, CancellationToken cancellationToken = default);
    Task<int> CreateAsync(Post post, CancellationToken cancellationToken = default);
    Task UpdateAsync(Post post, CancellationToken cancellationToken = default);
}
