using Microsoft.AspNetCore.Mvc;
using Nova.Dtos;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Route("api/productos")]
public sealed class ProductosController(SupabaseCatalogoService catalogo) : CatalogoControllerBase
{
    [HttpGet]
    public Task<IActionResult> Listar([FromQuery] string? buscar, [FromQuery] long? marca,
        [FromQuery] long? categoria, [FromQuery] string? estado, [FromQuery] int pagina = 1,
        [FromQuery] int tamano = 10, CancellationToken cancellationToken = default) => ConsultarAsync(async () =>
    {
        if (pagina < 1 || tamano is < 1 or > 100 || buscar?.Length > 120
            || (estado is not null and not "" and not "disponible" and not "bajo" and not "agotado" and not "inactivo"))
            return BadRequest(new { title = "Revisa los filtros o la paginación." });
        var productos = await catalogo.ProductosAsync(marca, categoria, buscar, null, cancellationToken);
        var filtrados = productos.Where(p => string.IsNullOrEmpty(estado) || p.Estado == estado).ToList();
        return Ok(new { total = filtrados.Count, pagina, tamano,
            items = filtrados.Skip((int)Math.Min((long)(pagina - 1) * tamano, int.MaxValue)).Take(tamano).Select(ProductoDto.DesdeModelo) });
    });
}
