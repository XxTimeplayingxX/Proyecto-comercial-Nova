using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Nova.Dtos;

namespace Nova.Infrastructure;

public sealed class SupabasePersonalService(IHttpClientFactory clients, IHttpContextAccessor accessor)
{
    public async Task<PerfilAccesoDto?> PerfilActivoAsync(Guid id, string token, CancellationToken ct)
    {
        var rows = await EnviarAsync<List<PerfilAccesoDto>>(HttpMethod.Get,
            $"profiles?id=eq.{id:D}&is_active=eq.true&select=role,first_name,last_name", null, ct, token);
        return rows.SingleOrDefault();
    }

    public async Task<bool> EsAdministradorAsync(CancellationToken ct)
    {
        var context = accessor.HttpContext!;
        if (!Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
            return false;
        var token = await context.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(token)) throw new SupabaseCatalogoException(HttpStatusCode.Unauthorized);
        return (await PerfilActivoAsync(id, token, ct))?.Role == "admin";
    }

    public async Task<VendedorDto?> DetalleAsync(Guid id, CancellationToken ct) =>
        (await EnviarAsync<List<VendedorDto>>(HttpMethod.Get,
            $"rpc/nova_seller_directory?id=eq.{id:D}", null, ct)).SingleOrDefault();

    public Task<List<ComprobanteVendedorDto>> ComprobantesAsync(Guid id, long? antesDe, CancellationToken ct) =>
        EnviarAsync<List<ComprobanteVendedorDto>>(HttpMethod.Get,
            $"sales?select=id,created_at,total&seller_id=eq.{id:D}&status=eq.completed&order=id.desc&limit=21"
            + (antesDe.HasValue ? $"&id=lt.{antesDe.Value}" : ""), null, ct);

    public async Task CompletarAltaAsync(CrearCuentaVendedorInput input, CancellationToken ct)
    {
        var id = await EnviarAsync<Guid>(HttpMethod.Post, "rpc/nova_complete_staff_account", new
        {
            p_id = input.OperacionId, p_first_name = input.Nombre.Trim(), p_last_name = input.Apellido.Trim(),
            p_role = input.Rol, p_active = input.Activo
        }, ct);
        if (id != input.OperacionId) throw new JsonException("No se confirmó el alta del perfil.");
    }

    public async Task EditarCuentaAsync(Guid id, CuentaVendedorInput input, CancellationToken ct)
    {
        var saved = await EnviarAsync<Guid>(HttpMethod.Post, "rpc/nova_update_staff_profile", new
        {
            p_id = id, p_first_name = input.Nombre.Trim(), p_last_name = input.Apellido.Trim(),
            p_role = input.Rol, p_active = input.Activo
        }, ct);
        if (saved != id) throw new JsonException("No se confirmó el cambio de perfil.");
    }

    public async Task<IReadOnlyList<VendedorDto>> ListarAsync(CancellationToken ct)
    {
        var rows = new List<VendedorDto>();
        const int pageSize = 200;
        for (var offset = 0; ;)
        {
            var page = await EnviarAsync<List<VendedorDto>>(HttpMethod.Get,
                $"rpc/nova_seller_directory?order=last_name.asc,first_name.asc,id.asc&limit={pageSize}&offset={offset}",
                null, ct);
            if (page.Count == 0) return rows;
            rows.AddRange(page);
            offset += page.Count;
        }
    }

    public async Task<Guid> VincularAsync(VincularVendedorInput input, CancellationToken ct)
    {
        var id = await EnviarAsync<Guid>(HttpMethod.Post, "rpc/nova_link_seller",
            new { p_auth_id = input.UsuarioId, p_first_name = input.Nombre.Trim(), p_last_name = input.Apellido.Trim() }, ct);
        return id == input.UsuarioId ? id : throw new JsonException("No se confirmó la vinculación.");
    }

    public async Task EditarAsync(Guid id, EditarVendedorInput input, CancellationToken ct)
    {
        var rows = await EnviarAsync<List<PerfilGuardado>>(HttpMethod.Patch, $"profiles?id=eq.{id:D}&role=eq.seller&select=id",
            new { first_name = input.Nombre.Trim(), last_name = input.Apellido.Trim(), is_active = input.Activo }, ct);
        if (rows.Count == 0) throw new SupabaseCatalogoException(HttpStatusCode.NotFound);
        if (rows.Count != 1 || rows[0].Id != id) throw new JsonException("No se confirmó el cambio de perfil.");
    }

    private async Task<T> EnviarAsync<T>(HttpMethod method, string path, object? body, CancellationToken ct, string? token = null)
    {
        token ??= await accessor.HttpContext!.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(token)) throw new SupabaseCatalogoException(HttpStatusCode.Unauthorized);
        using var client = clients.CreateClient(SupabaseOptions.SectionName);
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (method == HttpMethod.Patch) request.Headers.Add("Prefer", "return=representation");
        if (body is not null) request.Content = JsonContent.Create(body);
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw new SupabaseCatalogoException(response.StatusCode);
        return await response.Content.ReadFromJsonAsync<T>(ct) ?? throw new JsonException("Respuesta de perfiles vacía.");
    }

    private sealed record PerfilGuardado(Guid Id);
}
