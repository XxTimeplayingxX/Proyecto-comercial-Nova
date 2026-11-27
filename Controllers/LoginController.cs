using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Nova.Dtos;
using Nova.Infrastructure;
using Nova.Models;

namespace Nova.Controllers;

[Route("Login")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class LoginController(SupabaseAuthService authService, SupabasePersonalService personal, ILogger<LoginController> logger) : Controller
{
    [AcceptVerbs("GET", "HEAD")]
    [AcceptVerbs("GET", "HEAD", Route = "/")]
    public IActionResult Index() => User.Identity?.IsAuthenticated == true
        ? RedirectToPage(User.IsInRole("admin") ? "/Index" : "/Ventas")
        : View(new LoginInput());

    [HttpPost(Name = "SignIn")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Index(LoginInput input, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            ViewData["Toast"] = new ToastMessage(ToastStatus.Warning,
                "Revisa los campos", "Completa el correo electrónico y la contraseña.");
            return View(input);
        }

        SupabaseLoginResponse? session;
        try
        {
            session = await authService.SignInAsync(input.Email, input.Password, cancellationToken);
        }
        catch (OptionsValidationException exception)
        {
            logger.LogError("Configuración de Supabase incompleta o inválida: {ValidationErrors}",
                string.Join("; ", exception.Failures));
            return ShowError(input, "Falta configurar la conexión con Supabase. Revisa la URL del proyecto y la clave publicable.");
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException
            || (exception is OperationCanceledException && !cancellationToken.IsCancellationRequested))
        {
            logger.LogWarning("No se pudo completar el login en Supabase Auth. Tipo de error: {ErrorType}.",
                exception.GetType().Name);
            return ShowError(input, "El servicio no está disponible en este momento. Inténtalo de nuevo.");
        }

        if (session?.User is not { } user || user.Id == Guid.Empty || string.IsNullOrWhiteSpace(user.Email)
            || string.IsNullOrWhiteSpace(session.AccessToken)
            || session.ExpiresAt <= DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            || session.ExpiresAt > 253402300799)
        {
            return ShowError(input, "Verifica tus credenciales o inténtalo de nuevo en unos minutos.");
        }

        PerfilAccesoDto? perfil;
        try
        {
            perfil = await personal.PerfilActivoAsync(user.Id, session.AccessToken, cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or OptionsValidationException or SupabaseCatalogoException
            || ex is OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            return ShowError(input, "No se pudo verificar tu perfil comercial. Inténtalo de nuevo.");
        }
        if (perfil?.Role is not ("admin" or "seller"))
            return ShowError(input, "Tu correo necesita un perfil comercial activo. Contacta al administrador.");

        var properties = new AuthenticationProperties
        {
            IsPersistent = input.RememberMe
        };
        NovaSessionPolicy.Start(properties, DateTimeOffset.FromUnixTimeSeconds(session.ExpiresAt), DateTimeOffset.UtcNow);
        if (session.ExpiresIn is > 0)
            properties.Items["nova:token_lifetime"] = session.ExpiresIn.Value.ToString(System.Globalization.CultureInfo.InvariantCulture);
        properties.StoreTokens([new AuthenticationToken { Name = "access_token", Value = session.AccessToken }]);

        const string scheme = CookieAuthenticationDefaults.AuthenticationScheme;
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, perfil.Role)], scheme);
        await HttpContext.SignInAsync(scheme, new ClaimsPrincipal(identity), properties);

        TempData["LoginSuccess"] = true;
        return RedirectToPage(perfil.Role == "admin" ? "/Index" : "/Ventas");
    }

    [Authorize]
    [HttpPost("Salir", Name = "SignOutNova")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Salir()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        TempData.Remove("LoginSuccess");
        return LocalRedirect("~/Login");
    }

    private ViewResult ShowError(LoginInput input, string message)
    {
        ViewData["Toast"] = new ToastMessage(ToastStatus.Error, "No se pudo iniciar sesión", message);
        return View("Index", new LoginInput { Email = input.Email, RememberMe = input.RememberMe });
    }
}
