using Microsoft.EntityFrameworkCore;
using SocialMediaApp.Web.Entities;

namespace SocialMediaApp.Web.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Comment> Comments => Set<Comment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.UserName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(255).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(30).IsRequired();
            entity.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
            entity.Property(x => x.CoverImage).HasMaxLength(500);
            entity.Property(x => x.Biography).HasMaxLength(1000);
            entity.Property(x => x.CreatedAt).IsRequired();
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.PhoneNumber).IsUnique();
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.HasKey(x => x.PostId);
            entity.Property(x => x.Content).IsRequired();
            entity.Property(x => x.Image).HasMaxLength(500);
            entity.Property(x => x.CreatedAt).IsRequired();
            entity.HasOne(x => x.User)
                .WithMany(x => x.Posts)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<Comment>(entity =>
        {
            entity.HasKey(x => x.CommentId);
            entity.Property(x => x.Content).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.CreatedAt).IsRequired();
            entity.HasOne(x => x.User)
                .WithMany(x => x.Comments)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(x => x.Post)
                .WithMany(x => x.Comments)
                .HasForeignKey(x => x.PostId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });
    }
}
