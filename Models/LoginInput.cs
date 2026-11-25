using System.ComponentModel.DataAnnotations;

namespace Nova.Models;

public sealed class LoginInput
{
    [Required(ErrorMessage = "Ingresa tu correo electrónico.")]
    [EmailAddress(ErrorMessage = "Ingresa un correo electrónico válido.")]
    [StringLength(254, ErrorMessage = "El correo electrónico es demasiado largo.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Ingresa tu contraseña.")]
    [StringLength(1024, ErrorMessage = "La contraseña es demasiado larga.")]
    public string Password { get; set; } = string.Empty;

    public bool RememberMe { get; set; }
}
