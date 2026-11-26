using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Authorize(Roles = "admin")]
[Route("api/productos/{id:long}/trazabilidad")]
public sealed class ProductoTrazabilidadController(SupabaseCatalogoService catalogo, SupabasePersonalService personal) : CatalogoControllerBase
{
    [HttpGet]
    public Task<IActionResult> Consultar(long id, [FromQuery] string? antesDe, CancellationToken ct) => ConsultarAsync(async () =>
    {
        long? cursor = null;
        if (antesDe is not null)
        {
            if (!long.TryParse(antesDe, NumberStyles.None, CultureInfo.InvariantCulture, out var value) || value <= 0)
                return Problem(statusCode: 400, title: "El cursor del historial no es válido.");
            cursor = value;
        }
        if (id <= 0) return Problem(statusCode: 400, title: "El identificador del producto no es válido.");
        if (!await personal.EsAdministradorAsync(ct)) return Problem(statusCode: 403, title: "Se requiere un administrador activo.");
        var producto = await catalogo.ProductoHistorialAsync(id, ct);
        if (producto is null) return Problem(statusCode: 404, title: "El producto ya no está disponible.");

        var movimientos = await catalogo.MovimientosAsync(id, cursor, ct);
        return Ok(new
        {
            producto = new { nombre = producto.Name, producto.Sku, alta = producto.CreatedAt },
            siguiente = movimientos.Count > 20 ? movimientos[19].Id.ToString(CultureInfo.InvariantCulture) : null,
            items = movimientos.Take(20).Select(m => new
            {
                m.Tipo, m.Fecha, m.Cantidad, m.StockAnterior, m.StockNuevo, m.Motivo,
                responsable = m.Responsable?.NombreCompleto,
                venta = m.VentaId is long ventaId ? new
                {
                    id = ventaId.ToString(CultureInfo.InvariantCulture), estado = m.Venta?.Status,
                    vendedor = m.Venta?.Vendedor?.NombreCompleto, comprador = m.Venta?.Comprador?.Name
                } : null
            })
        });
    });
}
