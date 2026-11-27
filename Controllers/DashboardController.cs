using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Authorize(Roles = "admin"), Route("api/dashboard")]
public sealed class DashboardController(SupabaseDashboardService dashboard) : CatalogoControllerBase
{
    [HttpGet]
    public Task<IActionResult> Obtener([FromQuery] string periodo = "semana", [FromQuery] int pagina = 1,
        CancellationToken ct = default) => ConsultarAsync(async () =>
    {
        if (periodo is not ("hoy" or "semana" or "mes") || pagina is < 1 or > 100000)
            return BadRequest(new { title = "Selecciona hoy, semana o mes y una página válida." });
        return Ok(await dashboard.ObtenerAsync(periodo, pagina, ct));
    });

    [HttpGet("ventas/{id:long}")]
    public Task<IActionResult> Detalle(long id, CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (id <= 0) return BadRequest(new { title = "El identificador de venta no es válido." });
        var venta = await dashboard.DetalleAsync(id, ct);
        return venta is null ? NotFound(new { title = "La venta no está disponible." }) : Ok(venta);
    });
}
