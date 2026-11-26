using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Nova.Dtos;

public sealed record PerfilAccesoDto(string Role);
public sealed record ComprobanteVendedorDto(long Id, [property: JsonPropertyName("created_at")] DateTimeOffset Fecha, decimal Total);

public sealed record VendedorDto(Guid Id,
    [property: JsonPropertyName("first_name")] string Nombre,
    [property: JsonPropertyName("last_name")] string Apellido, string? Email, string Role,
    [property: JsonPropertyName("is_active")] bool Activo,
    [property: JsonPropertyName("sales_count")] long Ventas, decimal Total);

public sealed class VincularVendedorInput
{
    public Guid UsuarioId { get; set; }
    [Required, StringLength(80)]
    public string Nombre { get; set; } = "";
    [Required, StringLength(80)]
    public string Apellido { get; set; } = "";
}

public sealed class EditarVendedorInput
{
    [Required, StringLength(80)]
    public string Nombre { get; set; } = "";
    [Required, StringLength(80)]
    public string Apellido { get; set; } = "";
    [Required]
    public bool? Activo { get; set; }
}
