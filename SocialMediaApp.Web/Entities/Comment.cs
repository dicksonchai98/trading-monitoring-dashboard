namespace SocialMediaApp.Web.Entities;

public class Comment
{
    public int CommentId { get; set; }
    public int PostId { get; set; }
    public int UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; }

    public User? User { get; set; }
    public Post? Post { get; set; }
}
