using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Nova.Dtos;

public sealed class StockEntradaInput
{
    public static IReadOnlyList<string> Motivos { get; } = Array.AsReadOnly(new[]
    {
        "Ingreso de mercadería", "Devolución", "Corrección de inventario", "Otro"
    });

    [Range(1, int.MaxValue)]
    public int Cantidad { get; set; }

    [Required, StringLength(40)]
    public string Motivo { get; set; } = "";

    [StringLength(100)]
    public string? PuntoIngreso { get; set; }

    [StringLength(250)]
    public string? Observaciones { get; set; }
}

public sealed record StockEntradaDto([property: JsonPropertyName("product_id")] long Id, int Stock);
