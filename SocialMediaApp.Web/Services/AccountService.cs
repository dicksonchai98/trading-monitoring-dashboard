using Microsoft.AspNetCore.Identity;
using SocialMediaApp.Web.Common;
using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.Repositories.Interfaces;
using SocialMediaApp.Web.Services.Interfaces;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Services;

public class AccountService(IUserRepository userRepository) : IAccountService
{
    private readonly IUserRepository _userRepository = userRepository;
    private readonly PasswordHasher<User> _passwordHasher = new();

    public async Task<Result> RegisterAsync(RegisterViewModel model, CancellationToken cancellationToken = default)
    {
        var exists = await _userRepository.ExistsByPhoneOrEmailAsync(model.PhoneNumber, model.Email, cancellationToken);
        if (exists)
        {
            return Result.Failure("Phone number or email already exists.");
        }

        var user = new User
        {
            UserName = model.UserName,
            Email = model.Email,
            PhoneNumber = model.PhoneNumber,
            CreatedAt = DateTime.UtcNow
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, model.Password);
        await _userRepository.CreateAsync(user, cancellationToken);
        return Result.Success();
    }

    public async Task<Result<LoginIdentity>> LoginAsync(LoginViewModel model, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByPhoneAsync(model.PhoneNumber, cancellationToken);
        if (user is null)
        {
            return Result<LoginIdentity>.Failure("Invalid credentials.");
        }

        var verified = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, model.Password);
        if (verified == PasswordVerificationResult.Failed)
        {
            return Result<LoginIdentity>.Failure("Invalid credentials.");
        }

        return Result<LoginIdentity>.Success(new LoginIdentity
        {
            UserId = user.UserId,
            DisplayName = user.UserName
        });
    }
}
