using System.ComponentModel.DataAnnotations;

namespace SocialMediaApp.Web.ViewModels;

public class RegisterViewModel
{
    [Required, MaxLength(30)]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string UserName { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required, DataType(DataType.Password), MinLength(8), MaxLength(128)]
    public string Password { get; set; } = string.Empty;
}
