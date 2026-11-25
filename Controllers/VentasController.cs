using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Nova.Dtos;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Authorize, ApiController, Route("api/ventas")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class VentasController(SupabaseVentasService ventas) : ControllerBase
{
    [HttpGet("productos")]
    public Task<IActionResult> Productos([FromQuery] string? buscar, [FromQuery] long? categoria,
        [FromQuery] int pagina = 1, CancellationToken ct = default) => EjecutarAsync(async () =>
    {
        if (buscar?.Length > 120 || pagina is < 1 or > 1000000 || categoria is <= 0)
            return BadRequest(new { title = "Revisa la búsqueda, categoría o página." });
        var rows = await ventas.ProductosAsync(buscar, categoria, pagina, ct);
        return Ok(new { items = rows.Take(8).Select(ProductoDto.DesdeModelo), pagina, hayMas = rows.Count > 8 });
    });

    [HttpGet("clientes")]
    public Task<IActionResult> Clientes([FromQuery] string? buscar, CancellationToken ct) => EjecutarAsync(async () =>
    {
        if (buscar?.Length > 120) return BadRequest(new { title = "La búsqueda admite hasta 120 caracteres." });
        return Ok(await ventas.ClientesAsync(buscar, null, ct));
    });

    [HttpPost("validar"), ValidateAntiForgeryToken]
    public Task<IActionResult> Validar([FromBody] ValidarVentaInput input, CancellationToken ct) => EjecutarAsync(async () =>
    {
        var result = await ventas.ValidarAsync(input, ct);
        return StatusCode(result.Valida ? 200 : 409, result);
    });

    [HttpPost, ValidateAntiForgeryToken]
    public Task<IActionResult> Registrar([FromBody] RegistrarVentaInput input, CancellationToken ct) => EjecutarAsync(async () =>
    {
        if (input.RequestId == Guid.Empty) return BadRequest(new { title = "Se requiere un UUID de operación válido." });
        var result = await ventas.RegistrarAsync(input, ct);
        return Ok(new { saleId = result.SaleId, total = result.Total, replayed = result.Replayed });
    });

    private async Task<IActionResult> EjecutarAsync(Func<Task<IActionResult>> action)
    {
        try { return await action(); }
        catch (SupabaseVentaException ex)
        {
            var (status, title, code) = ex switch
            {
                { Status: HttpStatusCode.Unauthorized } => (401, "La sesión venció. Inicia sesión nuevamente.", "SESSION_EXPIRED"),
                { Status: HttpStatusCode.Forbidden } => (403, "Tu perfil no tiene permiso para realizar esta operación.", "ACCESS_DENIED"),
                { Reason: "INSUFFICIENT_STOCK" } => (409, "Las existencias cambiaron. Revisa las cantidades y vuelve a validar el pedido.", "INSUFFICIENT_STOCK"),
                { Reason: "REQUEST_ID_REUSED" } => (409, "Este identificador ya pertenece a otro pedido. Revisa la operación antes de continuar.", "REQUEST_ID_REUSED"),
                { Code: "23503" } => (400, "El cliente o producto seleccionado ya no está disponible.", "INVALID_REFERENCE"),
                { Status: HttpStatusCode.BadRequest } => (400, "Los datos de la venta no son válidos.", "INVALID_SALE"),
                _ => (502, "No se pudo confirmar la operación en Supabase.", "UPSTREAM_ERROR")
            };
            return StatusCode(status, new { title, code });
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or OptionsValidationException
            || ex is OperationCanceledException && !HttpContext.RequestAborted.IsCancellationRequested)
        {
            return StatusCode(503, new { title = "No se pudo confirmar la operación. Si estabas registrando, reintenta el mismo pedido.", code = "UNCONFIRMED" });
        }
    }
}
