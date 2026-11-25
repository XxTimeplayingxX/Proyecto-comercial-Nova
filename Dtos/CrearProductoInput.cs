using System.ComponentModel.DataAnnotations;

namespace Nova.Dtos;

public sealed class CrearProductoInput : IValidatableObject
{
    [Required, StringLength(200, MinimumLength = 3)]
    public string Nombre { get; set; } = "";
    [Required, StringLength(80)]
    public string Sku { get; set; } = "";
    [Range(1, long.MaxValue)]
    public long CategoriaId { get; set; }
    [Range(1, long.MaxValue)]
    public long MarcaId { get; set; }
    [Range(typeof(decimal), "0.01", "9999999999.99", ParseLimitsInInvariantCulture = true, ConvertValueInInvariantCulture = true)]
    public decimal Precio { get; set; }
    [Range(0, int.MaxValue)]
    public int StockMinimo { get; set; } = 2;
    public bool Activo { get; set; } = true;
    [StringLength(250)]
    public string? Descripcion { get; set; }
    [StringLength(2048)]
    public string? Imagen { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Nombre.Trim().Length < 3)
            yield return new ValidationResult("El nombre debe tener al menos 3 caracteres.", [nameof(Nombre)]);
        if (decimal.Round(Precio, 2) != Precio)
            yield return new ValidationResult("El precio admite hasta dos decimales.", [nameof(Precio)]);
        if (!string.IsNullOrWhiteSpace(Imagen))
        {
            var image = Imagen.Trim();
            var local = image.StartsWith('/') && !image.StartsWith("//", StringComparison.Ordinal) && !image.Contains('\\');
            if (!local && (!Uri.TryCreate(image, UriKind.Absolute, out var uri) || uri.Scheme != "https"))
                yield return new ValidationResult("La imagen debe ser una URL HTTPS o una ruta local absoluta válida.", [nameof(Imagen)]);
        }
    }
}
