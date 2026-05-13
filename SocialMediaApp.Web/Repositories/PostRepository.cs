using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using SocialMediaApp.Web.Data;
using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.Repositories.Interfaces;

namespace SocialMediaApp.Web.Repositories;

public class PostRepository(AppDbContext dbContext) : IPostRepository
{
    private readonly AppDbContext _dbContext = dbContext;

    public async Task<IReadOnlyList<Post>> GetFeedAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.Posts
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<Post?> GetByIdAsync(int postId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Posts.FirstOrDefaultAsync(x => x.PostId == postId, cancellationToken);
    }

    public async Task<int> CreateAsync(Post post, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = "sp_Post_Create";
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.Add(new SqlParameter("@UserId", post.UserId));
        command.Parameters.Add(new SqlParameter("@Content", post.Content));
        command.Parameters.Add(new SqlParameter("@Image", (object?)post.Image ?? DBNull.Value));

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (shouldClose)
        {
            await connection.CloseAsync();
        }

        return Convert.ToInt32(result);
    }

    public Task UpdateAsync(Post post, CancellationToken cancellationToken = default)
    {
        _dbContext.Posts.Update(post);
        return _dbContext.SaveChangesAsync(cancellationToken);
    }
}
