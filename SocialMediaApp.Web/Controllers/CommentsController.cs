using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SocialMediaApp.Web.Services.Interfaces;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Controllers;

[Authorize]
public class CommentsController(ICommentService commentService) : Controller
{
    private readonly ICommentService _commentService = commentService;

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CommentCreateViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            TempData["Error"] = "Invalid comment.";
            return Redirect($"/Posts#post-{model.PostId}");
        }

        var result = await _commentService.CreateAsync(GetCurrentUserId(), model, cancellationToken);
        TempData[result.IsSuccess ? "Success" : "Error"] = result.IsSuccess ? "Comment added." : result.Error;
        return Redirect($"/Posts#post-{model.PostId}");
    }

    private int GetCurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
