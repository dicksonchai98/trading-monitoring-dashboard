using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using SocialMediaApp.Web.Services.Interfaces;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Controllers;

public class AccountController(IAccountService accountService) : Controller
{
    private readonly IAccountService _accountService = accountService;
    private static readonly Dictionary<string, (int Count, DateTime Until)> LoginAttempts = new();

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
        if (LoginAttempts.TryGetValue(key, out var state) && state.Until > DateTime.UtcNow)
        {
            ModelState.AddModelError(string.Empty, "Account temporarily locked. Try again later.");
            return View(model);
        }

        var result = await _accountService.LoginAsync(model, cancellationToken);
        if (!result.IsSuccess || result.Value is null)
        {
            var count = state.Count + 1;
            var until = count >= 5 ? DateTime.UtcNow.AddMinutes(5) : DateTime.MinValue;
            LoginAttempts[key] = (count, until);
            ModelState.AddModelError(string.Empty, result.Error);
            return View(model);
        }

        LoginAttempts.Remove(key);
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
}
