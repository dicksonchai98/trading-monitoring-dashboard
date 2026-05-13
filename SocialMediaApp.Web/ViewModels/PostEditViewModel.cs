using System.ComponentModel.DataAnnotations;

namespace SocialMediaApp.Web.ViewModels;

public class PostEditViewModel
{
    public int PostId { get; set; }

    [Required, MaxLength(5000)]
    public string Content { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Image { get; set; }
}
