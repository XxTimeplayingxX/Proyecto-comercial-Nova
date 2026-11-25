using System.Text.Json.Serialization;

namespace Nova.Models;

public sealed record CatalogoOpcion(long Id, string Name);

public sealed record Producto(long Id, string Name, string Sku, decimal Price, int Stock,
    [property: JsonPropertyName("minimum_stock")] int MinimumStock,
    [property: JsonPropertyName("is_active")] bool IsActive,
    [property: JsonPropertyName("image_path")] string? ImagePath,
    CatalogoOpcion? Brands, CatalogoOpcion? Categories,
    string? Description = null,
    [property: JsonPropertyName("brand_id")] long BrandId = 0,
    [property: JsonPropertyName("category_id")] long CategoryId = 0)
{
    public string Estado => !IsActive ? "inactivo" : Stock == 0 ? "agotado"
        : Stock <= MinimumStock ? "bajo" : "disponible";
}
