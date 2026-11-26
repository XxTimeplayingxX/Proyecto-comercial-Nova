using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using Nova.Dtos;

namespace Nova.Infrastructure;

public sealed class SupabaseAuthAdminService(HttpClient http, IOptions<SupabaseOptions> options)
{
    public bool Disponible => options.Value.AuthAdminKey.StartsWith("sb_secret_", StringComparison.Ordinal);

    public async Task CrearAsync(CrearCuentaVendedorInput input, Guid actor, CancellationToken ct)
    {
        var path = $"users/{input.OperacionId:D}";
        var email = input.Email.Trim().ToLowerInvariant();
        var existing = await EnviarAsync(HttpMethod.Get, path, null, ct);
        if (existing is not null)
        {
            if (existing.Id != input.OperacionId || existing.Email != email || existing.AppMetadata?.Autor != actor)
                throw new SupabaseCatalogoException(HttpStatusCode.Conflict);
            return;
        }

        var created = await EnviarAsync(HttpMethod.Post, "users", new
        {
            id = input.OperacionId, email, password = input.Clave, email_confirm = true,
            app_metadata = new { nova_alta_por = actor }
        }, ct);
        if (created?.Id != input.OperacionId) throw new JsonException("No se confirmó el alta de Auth.");
    }

    public async Task CambiarCorreoAsync(Guid id, string email, CancellationToken ct) =>
        await ActualizarAsync(id, new { email = email.Trim().ToLowerInvariant(), email_confirm = true }, ct);

    public async Task CambiarClaveAsync(Guid id, string clave, CancellationToken ct) =>
        await ActualizarAsync(id, new { password = clave }, ct);

    private async Task ActualizarAsync(Guid id, object payload, CancellationToken ct)
    {
        var user = await EnviarAsync(HttpMethod.Put, $"users/{id:D}", payload, ct);
        if (user?.Id != id) throw new JsonException("No se confirmó el cambio en Auth.");
    }

    private async Task<UsuarioAuth?> EnviarAsync(HttpMethod method, string path, object? payload, CancellationToken ct)
    {
        var settings = options.Value;
        if (!Disponible) throw new SupabaseCatalogoException(HttpStatusCode.ServiceUnavailable);
        using var request = new HttpRequestMessage(method, new Uri(settings.ProjectUrl!, $"/auth/v1/admin/{path}"));
        request.Headers.Add("apikey", settings.AuthAdminKey);
        if (payload is not null) request.Content = JsonContent.Create(payload);
        using var response = await http.SendAsync(request, ct);
        if (method == HttpMethod.Get && response.StatusCode == HttpStatusCode.NotFound) return null;
        if (!response.IsSuccessStatusCode)
        {
            if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.UnprocessableEntity or HttpStatusCode.Conflict)
            {
                var error = await response.Content.ReadFromJsonAsync<ErrorAuth>(ct);
                throw new SupabaseCatalogoException(response.StatusCode == HttpStatusCode.Conflict || error?.Code is "email_exists" or "user_already_exists"
                    ? HttpStatusCode.Conflict : HttpStatusCode.BadRequest);
            }
            throw new SupabaseCatalogoException(HttpStatusCode.BadGateway);
        }
        return await response.Content.ReadFromJsonAsync<UsuarioAuth>(ct)
            ?? throw new JsonException("Respuesta de Auth vacía.");
    }

    private sealed record UsuarioAuth(Guid Id, string Email, [property: JsonPropertyName("app_metadata")] MetadatosAuth? AppMetadata);
    private sealed record MetadatosAuth([property: JsonPropertyName("nova_alta_por")] Guid? Autor);
    private sealed record ErrorAuth([property: JsonPropertyName("error_code")] string? Code);
}
