using SocialMediaApp.Web.Common;
using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Services.Interfaces;

public interface ICommentService
{
    Task<Result<Comment>> CreateAsync(int currentUserId, CommentCreateViewModel model, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Comment>> GetByPostIdAsync(int postId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Comment>> GetByPostIdsAsync(IReadOnlyCollection<int> postIds, CancellationToken cancellationToken = default);
}
