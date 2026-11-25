namespace Nova.Dtos;

public sealed record ProductoDto(Guid Id, string Nombre, decimal Precio, bool Disponible)
{
    public static ProductoDto DesdeModelo(Models.Producto producto) =>
        new(producto.Id, producto.Nombre, producto.Precio, producto.Stock > 0);
}
