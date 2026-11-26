using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Nova.Dtos;

public class CuentaVendedorInput
{
    [Required, StringLength(80)]
    public string Nombre { get; set; } = "";
    [Required, StringLength(80)]
    public string Apellido { get; set; } = "";
    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = "";
    [Required, RegularExpression("seller|admin")]
    public string Rol { get; set; } = "";
    [Required]
    public bool? Activo { get; set; }
}

public sealed class CrearCuentaVendedorInput : CuentaVendedorInput, IValidatableObject
{
    public Guid OperacionId { get; set; }
    [Required, StringLength(72, MinimumLength = 8)]
    public string Clave { get; set; } = "";
    [Required, Compare(nameof(Clave))]
    public string Confirmacion { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ClaveVendedorInput.Validar(Clave);
}

public sealed class ClaveVendedorInput : IValidatableObject
{
    [Required, StringLength(72, MinimumLength = 8)]
    public string Clave { get; set; } = "";
    [Required, Compare(nameof(Clave))]
    public string Confirmacion { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) => Validar(Clave);

    internal static IEnumerable<ValidationResult> Validar(string clave)
    {
        if (clave is null || !clave.Any(char.IsAsciiDigit) || Encoding.UTF8.GetByteCount(clave) > 72)
            yield return new ValidationResult("Usa al menos un número y un máximo de 72 bytes.", [nameof(Clave)]);
    }
}
