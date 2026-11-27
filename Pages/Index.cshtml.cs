using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;
using Nova.Infrastructure;

namespace Nova.Pages;

public sealed class IndexModel(SupabasePersonalService personal) : PageModel
{
    public async Task<IActionResult> OnGetAsync(CancellationToken ct)
    {
        try { return await personal.EsAdministradorAsync(ct) ? Page() : Forbid(); }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or OptionsValidationException or SupabaseCatalogoException
            || ex is OperationCanceledException && !ct.IsCancellationRequested)
        {
            return StatusCode(503, "No se pudo verificar el acceso administrativo. Intenta nuevamente.");
        }
    }
}
