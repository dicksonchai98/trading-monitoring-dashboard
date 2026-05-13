using Microsoft.Extensions.DependencyInjection;
using SocialMediaApp.Web.Repositories;
using SocialMediaApp.Web.Repositories.Interfaces;
using SocialMediaApp.Web.Services;
using SocialMediaApp.Web.Services.Interfaces;

namespace SocialMediaApp.Web.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IAccountService, AccountService>();
        services.AddScoped<IPostService, PostService>();
        services.AddScoped<ICommentService, CommentService>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IPostRepository, PostRepository>();
        services.AddScoped<ICommentRepository, CommentRepository>();

        return services;
    }
}
