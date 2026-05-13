using System.ComponentModel.DataAnnotations;

namespace SocialMediaApp.Web.ViewModels;

public class LoginViewModel
{
    [Required, MaxLength(30)]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required, DataType(DataType.Password), MaxLength(128)]
    public string Password { get; set; } = string.Empty;
}
