using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using SocialMediaApp.Web.Data;
using SocialMediaApp.Web.Entities;
using SocialMediaApp.Web.Repositories.Interfaces;

namespace SocialMediaApp.Web.Repositories;

public class UserRepository(AppDbContext dbContext) : IUserRepository
{
    private readonly AppDbContext _dbContext = dbContext;

    public async Task<bool> ExistsByPhoneOrEmailAsync(string phoneNumber, string email, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = "sp_User_ExistsByPhoneOrEmail";
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.Add(new SqlParameter("@PhoneNumber", phoneNumber));
        command.Parameters.Add(new SqlParameter("@Email", email));

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (shouldClose)
        {
            await connection.CloseAsync();
        }

        return Convert.ToInt32(result) > 0;
    }

    public async Task<int> CreateAsync(User user, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = "sp_User_Create";
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.Add(new SqlParameter("@UserName", user.UserName));
        command.Parameters.Add(new SqlParameter("@Email", user.Email));
        command.Parameters.Add(new SqlParameter("@PhoneNumber", user.PhoneNumber));
        command.Parameters.Add(new SqlParameter("@PasswordHash", user.PasswordHash));

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (shouldClose)
        {
            await connection.CloseAsync();
        }

        return Convert.ToInt32(result);
    }

    public async Task<User?> GetByPhoneAsync(string phoneNumber, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = "sp_User_GetByPhone";
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.Add(new SqlParameter("@PhoneNumber", phoneNumber));

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }

            return null;
        }

        var user = new User
        {
            UserId = reader.GetInt32(reader.GetOrdinal("UserId")),
            UserName = reader.GetString(reader.GetOrdinal("UserName")),
            Email = reader.GetString(reader.GetOrdinal("Email")),
            PasswordHash = reader.GetString(reader.GetOrdinal("PasswordHash")),
            PhoneNumber = reader.GetString(reader.GetOrdinal("PhoneNumber")),
            CoverImage = reader.IsDBNull(reader.GetOrdinal("CoverImage")) ? null : reader.GetString(reader.GetOrdinal("CoverImage")),
            Biography = reader.IsDBNull(reader.GetOrdinal("Biography")) ? null : reader.GetString(reader.GetOrdinal("Biography")),
            CreatedAt = reader.GetDateTime(reader.GetOrdinal("CreatedAt"))
        };

        if (shouldClose)
        {
            await connection.CloseAsync();
        }

        return user;
    }
}
