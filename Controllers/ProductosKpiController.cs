using Microsoft.AspNetCore.Mvc;
using Nova.Dtos;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Route("api/productos/kpi")]
public sealed class ProductosKpiController(SupabaseCatalogoService catalogo) : CatalogoControllerBase
{
    [HttpGet]
    public Task<IActionResult> Obtener(CancellationToken ct) => ConsultarAsync(async () =>
    {
        var activos = (await catalogo.ProductosAsync(null, null, null, null, ct)).Where(p => p.IsActive).ToList();
        return Ok(new ProductosKpiDto(activos.Count, activos.Count(p => p.Estado == "disponible"),
            activos.Count(p => p.Estado == "bajo"), activos.Count(p => p.Estado == "agotado")));
    });
}
