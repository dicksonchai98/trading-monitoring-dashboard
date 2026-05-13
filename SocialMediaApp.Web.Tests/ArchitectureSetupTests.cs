using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace SocialMediaApp.Web.Tests;

public class ArchitectureSetupTests
{
    private static readonly Assembly WebAssembly = typeof(Program).Assembly;

    [Fact]
    public void CoreLayerTypes_ShouldExist()
    {
        var requiredTypes = new[]
        {
            "SocialMediaApp.Web.Controllers.AccountController",
            "SocialMediaApp.Web.Controllers.PostsController",
            "SocialMediaApp.Web.Controllers.CommentsController",
            "SocialMediaApp.Web.Data.AppDbContext",
            "SocialMediaApp.Web.Services.Interfaces.IAccountService",
            "SocialMediaApp.Web.Services.Interfaces.IPostService",
            "SocialMediaApp.Web.Services.Interfaces.ICommentService",
            "SocialMediaApp.Web.Repositories.Interfaces.IUserRepository",
            "SocialMediaApp.Web.Repositories.Interfaces.IPostRepository",
            "SocialMediaApp.Web.Repositories.Interfaces.ICommentRepository"
        };

        var missing = requiredTypes.Where(typeName => WebAssembly.GetType(typeName) is null).ToArray();
        Assert.True(missing.Length == 0, $"Missing types: {string.Join(", ", missing)}");
    }

    [Fact]
    public void DependencyInjection_ShouldRegisterServiceAndRepositoryInterfaces()
    {
        var services = new ServiceCollection();
        var extensionType = WebAssembly.GetType("SocialMediaApp.Web.DependencyInjection.ServiceCollectionExtensions");
        Assert.NotNull(extensionType);

        var addApplicationServices = extensionType!.GetMethod("AddApplicationServices", BindingFlags.Public | BindingFlags.Static);
        Assert.NotNull(addApplicationServices);

        addApplicationServices!.Invoke(null, new object[] { services });

        AssertRegistration(services, "SocialMediaApp.Web.Services.Interfaces.IAccountService", "SocialMediaApp.Web.Services.AccountService");
        AssertRegistration(services, "SocialMediaApp.Web.Services.Interfaces.IPostService", "SocialMediaApp.Web.Services.PostService");
        AssertRegistration(services, "SocialMediaApp.Web.Services.Interfaces.ICommentService", "SocialMediaApp.Web.Services.CommentService");
        AssertRegistration(services, "SocialMediaApp.Web.Repositories.Interfaces.IUserRepository", "SocialMediaApp.Web.Repositories.UserRepository");
        AssertRegistration(services, "SocialMediaApp.Web.Repositories.Interfaces.IPostRepository", "SocialMediaApp.Web.Repositories.PostRepository");
        AssertRegistration(services, "SocialMediaApp.Web.Repositories.Interfaces.ICommentRepository", "SocialMediaApp.Web.Repositories.CommentRepository");
    }

    [Fact]
    public void Controllers_ShouldNotDependOnDbContext()
    {
        var dbContextType = WebAssembly.GetType("SocialMediaApp.Web.Data.AppDbContext");
        Assert.NotNull(dbContextType);

        var controllerNames = new[]
        {
            "SocialMediaApp.Web.Controllers.AccountController",
            "SocialMediaApp.Web.Controllers.PostsController",
            "SocialMediaApp.Web.Controllers.CommentsController"
        };

        foreach (var controllerName in controllerNames)
        {
            var controllerType = WebAssembly.GetType(controllerName);
            Assert.NotNull(controllerType);

            foreach (var ctor in controllerType!.GetConstructors())
            {
                var hasDbContextParam = ctor.GetParameters().Any(p => dbContextType!.IsAssignableFrom(p.ParameterType));
                Assert.False(hasDbContextParam, $"{controllerName} constructor cannot directly depend on AppDbContext.");
            }
        }
    }

    private static void AssertRegistration(IServiceCollection services, string serviceTypeName, string implementationTypeName)
    {
        var serviceType = WebAssembly.GetType(serviceTypeName);
        var implementationType = WebAssembly.GetType(implementationTypeName);
        Assert.NotNull(serviceType);
        Assert.NotNull(implementationType);

        var descriptor = services.FirstOrDefault(d => d.ServiceType == serviceType);
        Assert.NotNull(descriptor);
        Assert.Equal(implementationType, descriptor!.ImplementationType);
    }
}
