using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SocialMediaApp.Web.Services.Interfaces;
using SocialMediaApp.Web.ViewModels;

namespace SocialMediaApp.Web.Controllers;

public class PostsController(IPostService postService, ICommentService commentService) : Controller
{
    private readonly IPostService _postService = postService;
    private readonly ICommentService _commentService = commentService;

    [HttpGet]
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        var posts = await _postService.GetFeedAsync(cancellationToken);
        ViewBag.NewPost = new PostEditViewModel();
        ViewBag.CurrentUserId = TryGetCurrentUserId();
        var postIds = posts.Select(x => x.PostId).ToArray();
        var allComments = await _commentService.GetByPostIdsAsync(postIds, cancellationToken);
        var commentMap = allComments
            .GroupBy(x => x.PostId)
            .ToDictionary(x => x.Key, x => (IReadOnlyList<SocialMediaApp.Web.Entities.Comment>)x.ToList());

        ViewBag.CommentMap = commentMap;
        return View(posts);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Edit(int id, CancellationToken cancellationToken)
    {
        var currentUserId = GetCurrentUserId();
        var result = await _postService.GetEditablePostAsync(id, currentUserId, cancellationToken);
        if (!result.IsSuccess || result.Value is null)
        {
            TempData["Error"] = result.Error;
            return RedirectToAction(nameof(Index));
        }

        return View(new PostEditViewModel
        {
            PostId = result.Value.PostId,
            Content = result.Value.Content
        });
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(PostEditViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            TempData["Error"] = "Invalid post content.";
            return RedirectToAction(nameof(Index));
        }

        var result = await _postService.CreateAsync(GetCurrentUserId(), model, cancellationToken);
        if (!result.IsSuccess)
        {
            TempData["Error"] = result.Error;
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(PostEditViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var result = await _postService.UpdateAsync(GetCurrentUserId(), model, cancellationToken);
        if (!result.IsSuccess)
        {
            TempData["Error"] = result.Error;
            return RedirectToAction(nameof(Index));
        }

        TempData["Success"] = "Post updated.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var result = await _postService.DeleteAsync(id, GetCurrentUserId(), cancellationToken);
        TempData[result.IsSuccess ? "Success" : "Error"] = result.IsSuccess ? "Post deleted." : result.Error;
        return RedirectToAction(nameof(Index));
    }

    private int GetCurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private int? TryGetCurrentUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(claim, out var id) ? id : null;
    }
}
