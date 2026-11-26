using System.Text.Json.Serialization;

namespace Nova.Dtos;

public sealed record ProductoHistorialDto(long Id, string Name, string Sku,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt);

public sealed record MovimientoStockDto(long Id,
    [property: JsonPropertyName("movement_type")] string Tipo,
    [property: JsonPropertyName("created_at")] DateTimeOffset Fecha,
    [property: JsonPropertyName("quantity")] int Cantidad,
    [property: JsonPropertyName("previous_stock")] int StockAnterior,
    [property: JsonPropertyName("new_stock")] int StockNuevo,
    [property: JsonPropertyName("reason")] string? Motivo,
    [property: JsonPropertyName("sale_id")] long? VentaId,
    PersonaMovimientoDto? Responsable, VentaMovimientoDto? Venta);

public sealed record PersonaMovimientoDto(
    [property: JsonPropertyName("first_name")] string Nombre,
    [property: JsonPropertyName("last_name")] string Apellido)
{
    public string NombreCompleto => $"{Nombre} {Apellido}".Trim();
}

public sealed record VentaMovimientoDto(string Status, PersonaMovimientoDto? Vendedor, ClienteMovimientoDto? Comprador);
public sealed record ClienteMovimientoDto(string Name);
