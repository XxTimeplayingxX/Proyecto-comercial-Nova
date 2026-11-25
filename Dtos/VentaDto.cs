using System.ComponentModel.DataAnnotations;

namespace Nova.Dtos;

public sealed class VentaItemInput
{
    [Range(1, long.MaxValue)] public long ProductoId { get; set; }
    [Range(1, int.MaxValue)] public int Cantidad { get; set; }
}

public class ValidarVentaInput : IValidatableObject
{
    [Range(1, long.MaxValue)] public long? ClienteId { get; set; }
    [Required, MinLength(1), MaxLength(100)] public List<VentaItemInput> Items { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (Items.Any(x => x is null))
        {
            yield return new ValidationResult("Los artículos no pueden ser nulos.", [nameof(Items)]);
            yield break;
        }
        if (Items.Select(x => x.ProductoId).Distinct().Count() != Items.Count)
            yield return new ValidationResult("Cada producto debe aparecer una sola vez.", [nameof(Items)]);
    }
}

public sealed class RegistrarVentaInput : ValidarVentaInput
{
    public Guid RequestId { get; set; }
}

public sealed record VentaLineaDto(long ProductoId, string Nombre, string Sku, int Cantidad,
    int Stock, decimal Precio, decimal Subtotal, string? Imagen);
public sealed record VentaValidacionDto(bool Valida, decimal Total, List<VentaLineaDto> Items, List<string> Errores);
public sealed record ClienteVentaDto(long Id, string Name);
