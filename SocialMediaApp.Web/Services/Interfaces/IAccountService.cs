using SocialMediaApp.Web.Common;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Services.Interfaces;

public interface IAccountService
{
    Task<Result> RegisterAsync(RegisterViewModel model, CancellationToken cancellationToken = default);
    Task<Result<LoginIdentity>> LoginAsync(LoginViewModel model, CancellationToken cancellationToken = default);
}

public class LoginIdentity
{
    public int UserId { get; init; }
    public string DisplayName { get; init; } = string.Empty;
}
