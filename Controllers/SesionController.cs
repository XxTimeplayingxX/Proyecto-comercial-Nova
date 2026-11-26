using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Authorize, ApiController, Route("api/sesion")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SesionController(SupabasePersonalService personal) : CatalogoControllerBase
{
    [HttpGet]
    public Task<IActionResult> Obtener(CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return Unauthorized();
        var token = await HttpContext.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(token)) return Unauthorized();
        var profile = await personal.PerfilActivoAsync(id, token, ct);
        if (profile?.Role is not ("admin" or "seller")) return Problem(statusCode: 403, title: "Tu perfil comercial no está activo.");
        var auth = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (auth.Properties is not { } properties || NovaSessionPolicy.IsExpired(properties, DateTimeOffset.UtcNow)) return Unauthorized();
        var tokenExpiry = properties.Items.TryGetValue(NovaSessionPolicy.TokenExpiryKey, out var expiry) && long.TryParse(expiry, out var stamp) ? (long?)stamp : null;
        var tokenLifetime = properties.Items.TryGetValue("nova:token_lifetime", out var lifetime) && long.TryParse(lifetime, out var seconds) ? (long?)seconds : null;
        return Ok(new { nombre = profile.Nombre, apellido = profile.Apellido, email = User.FindFirstValue(ClaimTypes.Email),
            rol = profile.Role, venceEn = properties.ExpiresUtc?.ToUnixTimeSeconds(), tokenVenceEn = tokenExpiry, tokenDuracionSegundos = tokenLifetime,
            ultimaActividad = NovaSessionPolicy.LastActivity(properties), ahora = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            avisoSegundos = NovaSessionPolicy.WarningSeconds, inactividadSegundos = NovaSessionPolicy.IdleSeconds,
            maximoMinutos = NovaSessionPolicy.AbsoluteMinutes });
    });

    [HttpPost("actividad"), ValidateAntiForgeryToken]
    public async Task<IActionResult> Actividad()
    {
        var auth = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (auth.Principal is null || auth.Properties is not { } properties
            || NovaSessionPolicy.IsExpired(properties, DateTimeOffset.UtcNow)) return Unauthorized();
        NovaSessionPolicy.Touch(properties, DateTimeOffset.UtcNow);
        // Keep the original issue/expiry and token; activity never extends the absolute session limit.
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, auth.Principal, properties);
        return Ok(new { ultimaActividad = NovaSessionPolicy.LastActivity(properties),
            venceEn = properties.ExpiresUtc?.ToUnixTimeSeconds(), ahora = DateTimeOffset.UtcNow.ToUnixTimeSeconds() });
    }
}
