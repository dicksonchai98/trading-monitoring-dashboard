using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using SocialMediaApp.Web.Data;
using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.Repositories.Interfaces;

namespace SocialMediaApp.Web.Repositories;

public class CommentRepository(AppDbContext dbContext) : ICommentRepository
{
    private readonly AppDbContext _dbContext = dbContext;

    public async Task<Comment> CreateAsync(Comment comment, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = "sp_Comment_Create";
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.Add(new SqlParameter("@UserId", comment.UserId));
        command.Parameters.Add(new SqlParameter("@PostId", comment.PostId));
        command.Parameters.Add(new SqlParameter("@Content", comment.Content));

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (shouldClose)
        {
            await connection.CloseAsync();
        }

        comment.CommentId = Convert.ToInt32(result);
        return comment;
    }

    public async Task<IReadOnlyList<Comment>> GetByPostIdAsync(int postId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Comments
            .AsNoTracking()
            .Include(x => x.User)
            .Where(x => x.PostId == postId && !x.IsDeleted)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Comment>> GetByPostIdsAsync(IReadOnlyCollection<int> postIds, CancellationToken cancellationToken = default)
    {
        if (postIds.Count == 0)
        {
            return Array.Empty<Comment>();
        }

        return await _dbContext.Comments
            .AsNoTracking()
            .Include(x => x.User)
            .Where(x => postIds.Contains(x.PostId) && !x.IsDeleted)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task SoftDeleteByPostIdAsync(int postId, CancellationToken cancellationToken = default)
    {
        await _dbContext.Comments
            .Where(x => x.PostId == postId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsDeleted, true), cancellationToken);
    }
}
