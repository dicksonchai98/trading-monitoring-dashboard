using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.Repositories.Interfaces;
using SocialMediaApp.Web.Services;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Tests;

public class AccountServiceTests
{
    [Fact]
    public async Task RegisterAsync_ShouldFailWhenDuplicateExists()
    {
        var service = new AccountService(new StubUserRepository(exists: true));
        var result = await service.RegisterAsync(new RegisterViewModel
        {
            UserName = "u",
            Email = "u@example.com",
            PhoneNumber = "123",
            Password = "password123"
        });

        Assert.False(result.IsSuccess);
    }

    [Fact]
    public async Task LoginAsync_ShouldSucceedWithValidPassword()
    {
        var service = new AccountService(new StubUserRepository(exists: false, returnUser: true));
        var result = await service.LoginAsync(new LoginViewModel
        {
            PhoneNumber = "123",
            Password = "password123"
        });

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
    }

    private sealed class StubUserRepository(bool exists, bool returnUser = false) : IUserRepository
    {
        public Task<bool> ExistsByPhoneOrEmailAsync(string phoneNumber, string email, CancellationToken cancellationToken = default)
            => Task.FromResult(exists);

        public Task<int> CreateAsync(User user, CancellationToken cancellationToken = default)
            => Task.FromResult(1);

        public Task<User?> GetByPhoneAsync(string phoneNumber, CancellationToken cancellationToken = default)
        {
            if (!returnUser)
            {
                return Task.FromResult<User?>(null);
            }

            var user = new User
            {
                UserId = 42,
                UserName = "Tester",
                PhoneNumber = phoneNumber,
                Email = "t@example.com"
            };

            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
            user.PasswordHash = hasher.HashPassword(user, "password123");
            return Task.FromResult<User?>(user);
        }
    }
}
