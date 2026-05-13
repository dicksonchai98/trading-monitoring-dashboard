namespace SocialMediaApp.Web.Entities;

public class Post
{
    public int PostId { get; set; }
    public int UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? Image { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; }

    public User? User { get; set; }
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
}
