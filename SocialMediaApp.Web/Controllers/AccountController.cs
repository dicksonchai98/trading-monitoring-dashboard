using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.Mvc;
using SocialMediaApp.Web.Services.Interfaces;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Controllers;

public class AccountController(IAccountService accountService, IMemoryCache memoryCache) : Controller
{
    private readonly IAccountService _accountService = accountService;
    private readonly IMemoryCache _memoryCache = memoryCache;
    private const int MaxLoginAttempts = 5;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(5);

    [HttpGet]
    public IActionResult Register() => View(new RegisterViewModel());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(RegisterViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var result = await _accountService.RegisterAsync(model, cancellationToken);
        if (!result.IsSuccess)
        {
            ModelState.AddModelError(string.Empty, result.Error);
            return View(model);
        }

        TempData["Success"] = "Registration completed. Please login.";
        return RedirectToAction(nameof(Login));
    }

    [HttpGet]
    public IActionResult Login() => View(new LoginViewModel());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var key = model.PhoneNumber.Trim();
        var cacheKey = $"login-attempts:{key}";
        var state = _memoryCache.Get<LoginAttemptState>(cacheKey) ?? new LoginAttemptState();
        if (state.LockedUntil.HasValue && state.LockedUntil.Value > DateTime.UtcNow)
        {
            ModelState.AddModelError(string.Empty, "Account temporarily locked. Try again later.");
            return View(model);
        }

        var result = await _accountService.LoginAsync(model, cancellationToken);
        if (!result.IsSuccess || result.Value is null)
        {
            state.Count++;
            if (state.Count >= MaxLoginAttempts)
            {
                state.LockedUntil = DateTime.UtcNow.Add(LockoutWindow);
            }

            _memoryCache.Set(cacheKey, state, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = LockoutWindow
            });
            ModelState.AddModelError(string.Empty, result.Error);
            return View(model);
        }

        _memoryCache.Remove(cacheKey);
        var userId = result.Value.UserId;
        var displayName = result.Value.DisplayName;
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("PhoneNumber", model.PhoneNumber),
            new Claim(ClaimTypes.Name, displayName)
        };

        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

        return RedirectToAction("Index", "Posts");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction(nameof(Login));
    }

    private sealed class LoginAttemptState
    {
        public int Count { get; set; }
        public DateTime? LockedUntil { get; set; }
    }
}
