using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Authorize]
[ApiController]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public abstract class CatalogoControllerBase : ControllerBase
{
    protected async Task<IActionResult> ConsultarAsync(Func<Task<IActionResult>> consulta)
    {
        try { return await consulta(); }
        catch (SupabaseCatalogoException ex)
        {
            var status = ex.Status is HttpStatusCode.Unauthorized ? 401
                : ex.Status is HttpStatusCode.Forbidden ? 403 : 502;
            return Problem(statusCode: status, title: status == 401 ? "La sesión venció. Inicia sesión nuevamente."
                : status == 403 ? "Tu perfil no tiene permiso para consultar estos datos."
                : "No se pudo consultar el catálogo en Supabase.");
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or OptionsValidationException
            || ex is OperationCanceledException && !HttpContext.RequestAborted.IsCancellationRequested)
        {
            return Problem(statusCode: 503, title: "Supabase no está disponible o falta su configuración. Inténtalo de nuevo.");
        }
    }
}
