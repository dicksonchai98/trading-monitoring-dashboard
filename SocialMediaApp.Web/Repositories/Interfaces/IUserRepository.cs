using SocialMediaApp.Web.Entities;

namespace SocialMediaApp.Web.Repositories.Interfaces;

public interface IUserRepository
{
    Task<bool> ExistsByPhoneOrEmailAsync(string phoneNumber, string email, CancellationToken cancellationToken = default);
    Task<int> CreateAsync(User user, CancellationToken cancellationToken = default);
    Task<User?> GetByPhoneAsync(string phoneNumber, CancellationToken cancellationToken = default);
}
