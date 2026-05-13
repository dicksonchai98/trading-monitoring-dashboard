using System.ComponentModel.DataAnnotations;

namespace SocialMediaApp.Web.ViewModels;

public class CommentCreateViewModel
{
    public int PostId { get; set; }

    [Required, MaxLength(2000)]
    public string Content { get; set; } = string.Empty;
}
