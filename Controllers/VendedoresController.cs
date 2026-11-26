using System.Net;
using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nova.Dtos;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Authorize(Roles = "admin")]
[Route("api/vendedores")]
public sealed class VendedoresController(SupabasePersonalService personal, SupabaseAuthAdminService authAdmin) : CatalogoControllerBase
{
    [HttpGet("{id:guid}")]
    public Task<IActionResult> Detalle(Guid id, CancellationToken ct) => ConsultarAsync(async () =>
    {
        var item = await personal.DetalleAsync(id, ct);
        return item is null ? NotFound() : Ok(new { item.Id, item.Nombre, item.Apellido, item.Email,
            item.Role, item.Activo, item.Ventas, item.Total, propio = EsCuentaPropia(id) });
    });

    [HttpGet("{id:guid}/comprobantes")]
    public Task<IActionResult> Comprobantes(Guid id, [FromQuery] long? antesDe, CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (antesDe <= 0) return Problem(statusCode: 400, title: "El cursor no es válido.");
        if (!await personal.EsAdministradorAsync(ct)) return Problem(statusCode: 403, title: "Se requiere un administrador activo.");
        var list = await personal.ComprobantesAsync(id, antesDe, ct);
        return Ok(new
        {
            siguiente = list.Count > 20 ? list[19].Id.ToString(CultureInfo.InvariantCulture) : null,
            items = list.Take(20).Select(x => new { id = x.Id.ToString(CultureInfo.InvariantCulture), x.Fecha, x.Total })
        });
    });

    [HttpPost("alta")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Alta([FromBody] CrearCuentaVendedorInput input, CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (input.OperacionId == Guid.Empty) return Problem(statusCode: 400, title: "El identificador de alta no es válido.");
        if (!await personal.EsAdministradorAsync(ct)) return Problem(statusCode: 403, title: "Se requiere un administrador activo.");
        if (!authAdmin.Disponible) return AuthSinConfigurar();
        try
        {
            await authAdmin.CrearAsync(input, Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), ct);
            await personal.CompletarAltaAsync(input, ct);
            return StatusCode(201, new { id = input.OperacionId });
        }
        catch (SupabaseCatalogoException ex) when (ex.Status is HttpStatusCode.BadRequest or HttpStatusCode.Conflict)
        {
            return ErrorCuenta(ex);
        }
    });

    [HttpPatch("{id:guid}/cuenta")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> EditarCuenta(Guid id, [FromBody] CuentaVendedorInput input, CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (!await personal.EsAdministradorAsync(ct) || EsCuentaPropia(id)) return CuentaNoAdministrable();
        var current = await personal.DetalleAsync(id, ct);
        if (current is null) return NotFound();
        try
        {
            if (!string.Equals(input.Email.Trim(), current.Email, StringComparison.OrdinalIgnoreCase))
            {
                if (!authAdmin.Disponible) return AuthSinConfigurar();
                await authAdmin.CambiarCorreoAsync(id, input.Email, ct);
            }
            await personal.EditarCuentaAsync(id, input, ct);
            return Ok(new { id });
        }
        catch (SupabaseCatalogoException ex) when (ex.Status is HttpStatusCode.BadRequest or HttpStatusCode.Conflict)
        {
            return ErrorCuenta(ex);
        }
    });

    [HttpPost("{id:guid}/clave")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Clave(Guid id, [FromBody] ClaveVendedorInput input, CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (!await personal.EsAdministradorAsync(ct) || EsCuentaPropia(id)) return CuentaNoAdministrable();
        if (await personal.DetalleAsync(id, ct) is null) return NotFound();
        if (!authAdmin.Disponible) return AuthSinConfigurar();
        try
        {
            await authAdmin.CambiarClaveAsync(id, input.Clave, ct);
            return NoContent();
        }
        catch (SupabaseCatalogoException ex) when (ex.Status == HttpStatusCode.BadRequest)
        {
            return ErrorCuenta(ex);
        }
    });

    private bool EsCuentaPropia(Guid id) => User.FindFirstValue(ClaimTypes.NameIdentifier) == id.ToString();
    private ObjectResult CuentaNoAdministrable() => Problem(statusCode: 403, title: "Un administrador activo puede gestionar otras cuentas.");
    private ObjectResult AuthSinConfigurar() => Problem(statusCode: 503, title: "Configura el acceso administrativo de Supabase Auth en el servidor.");
    private ObjectResult ErrorCuenta(SupabaseCatalogoException ex) => ex.Status == HttpStatusCode.Conflict
        ? Problem(statusCode: 409, title: "El correo ya está en uso o el perfil ya está registrado con otros datos.")
        : Problem(statusCode: 400, title: "Revisa los datos de la cuenta y los requisitos de contraseña de Auth.");

    [HttpGet]
    public Task<IActionResult> Listar(CancellationToken ct) => ConsultarAsync(async () =>
    {
        var items = await personal.ListarAsync(ct);
        var activos = items.Count(x => x.Activo);
        return Ok(new
        {
            total = items.Count, activos, inactivos = items.Count - activos,
            items = items.Select(x => new { x.Id, x.Nombre, x.Apellido, x.Email, x.Role, x.Activo, x.Ventas, x.Total,
                propio = EsCuentaPropia(x.Id) })
        });
    });

    [HttpPost]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Vincular([FromBody] VincularVendedorInput input, CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (input.UsuarioId == Guid.Empty) return Problem(statusCode: 400, title: "Ingresa el UUID del usuario de Supabase Auth.");
        try
        {
            var id = await personal.VincularAsync(input, ct);
            return StatusCode(201, new { id });
        }
        catch (SupabaseCatalogoException ex) when (ex.Status == HttpStatusCode.Conflict)
        {
            return Problem(statusCode: 409, title: "La cuenta no existe, no tiene correo confirmado y contraseña o ya tiene un perfil.");
        }
        catch (SupabaseCatalogoException ex) when (ex.Status == HttpStatusCode.BadRequest)
        {
            return Problem(statusCode: 400, title: "Revisa el nombre y el apellido del vendedor.");
        }
    });

    [HttpPatch("{id:guid}")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Editar(Guid id, [FromBody] EditarVendedorInput input, CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (id == Guid.Empty) return Problem(statusCode: 400, title: "Ingresa un identificador válido.");
        if (!await personal.EsAdministradorAsync(ct)) return Problem(statusCode: 403, title: "Se requiere un administrador activo.");
        try
        {
            await personal.EditarAsync(id, input, ct);
            return Ok(new { id });
        }
        catch (SupabaseCatalogoException ex) when (ex.Status == HttpStatusCode.NotFound)
        {
            return Problem(statusCode: 404, title: "El perfil de vendedor ya no está disponible.");
        }
    });
}
