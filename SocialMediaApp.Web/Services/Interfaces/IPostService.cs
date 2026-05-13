using SocialMediaApp.Web.Common;
using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Services.Interfaces;

public interface IPostService
{
    Task<IReadOnlyList<Post>> GetFeedAsync(CancellationToken cancellationToken = default);
    Task<Result<Post>> CreateAsync(int currentUserId, PostEditViewModel model, CancellationToken cancellationToken = default);
    Task<Result<Post>> GetEditablePostAsync(int postId, int currentUserId, CancellationToken cancellationToken = default);
    Task<Result> UpdateAsync(int currentUserId, PostEditViewModel model, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(int postId, int currentUserId, CancellationToken cancellationToken = default);
}
