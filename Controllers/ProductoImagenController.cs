using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Authorize, ApiController, Route("api/productos/imagen")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProductoImagenController(SupabaseStorageService storage) : ControllerBase
{
    [HttpPost, ValidateAntiForgeryToken]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<IActionResult> Subir([FromForm] IFormFile archivo, CancellationToken ct)
    {
        try
        {
            var result = await storage.SubirAsync(archivo, ct);
            return StatusCode(201, result);
        }
        catch (ImagenProductoException ex) { return Problem(statusCode: 400, title: ex.Message); }
        catch (SupabaseStorageException ex)
        {
            var status = ex.Status == HttpStatusCode.Unauthorized ? 401 : ex.Status == HttpStatusCode.Forbidden ? 403 : 502;
            return Problem(statusCode: status, title: status == 401 ? "La sesión venció. Inicia sesión nuevamente."
                : status == 403 ? "Solo un administrador activo puede subir imágenes."
                : "No se pudo confirmar la carga de la imagen en Storage.");
        }
        catch (Exception ex) when (ex is HttpRequestException or OptionsValidationException
            || ex is OperationCanceledException && !HttpContext.RequestAborted.IsCancellationRequested)
        {
            return Problem(statusCode: 503, title: "No se pudo confirmar la carga de la imagen. Inténtalo de nuevo.");
        }
    }
}
