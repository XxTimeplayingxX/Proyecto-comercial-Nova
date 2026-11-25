namespace Nova.Dtos;

public sealed record ProductoDto(long Id, string Nombre, string Sku, decimal Precio, int Stock,
    int StockMinimo, bool Activo, string Estado, string? Imagen, Models.CatalogoOpcion? Marca,
    Models.CatalogoOpcion? Categoria)
{
    public static ProductoDto DesdeModelo(Models.Producto producto) =>
        new(producto.Id, producto.Name, producto.Sku, producto.Price, producto.Stock, producto.MinimumStock,
            producto.IsActive, producto.Estado, producto.ImagePath, producto.Brands, producto.Categories);
}

public sealed record ProductosKpiDto(int Total, int Disponibles, int StockBajo, int Agotados);
