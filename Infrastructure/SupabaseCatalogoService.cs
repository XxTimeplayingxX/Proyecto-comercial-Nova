using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Nova.Models;

namespace Nova.Infrastructure;

public sealed class SupabaseCatalogoException(HttpStatusCode status) : Exception
{
    public HttpStatusCode Status { get; } = status;
}

public sealed class SupabaseCatalogoService(IHttpClientFactory clients, IHttpContextAccessor accessor)
{
    private async Task<List<T>> LeerAsync<T>(string query, CancellationToken ct)
    {
        var token = await accessor.HttpContext!.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(token)) throw new SupabaseCatalogoException(HttpStatusCode.Unauthorized);
        using var client = clients.CreateClient(SupabaseOptions.SectionName);
        var result = new List<T>();
        // Read every range, including when PostgREST caps returned rows.
        for (var offset = 0; ;)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{query}&limit=500&offset={offset}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) throw new SupabaseCatalogoException(response.StatusCode);
            var rows = await response.Content.ReadFromJsonAsync<List<T>>(ct)
                ?? throw new JsonException("Respuesta de catálogo vacía.");
            if (rows.Count == 0) break;
            result.AddRange(rows);
            offset += rows.Count;
        }
        return result;
    }

    public Task<List<Producto>> ProductosAsync(long? marca, long? categoria, string? buscar, long? id, CancellationToken ct)
    {
        var query = "products?select=*,brands(id,name),categories(id,name)&order=id.asc";
        if (marca.HasValue) query += $"&brand_id=eq.{marca.Value}";
        if (categoria.HasValue) query += $"&category_id=eq.{categoria.Value}";
        if (id.HasValue) query += $"&id=eq.{id.Value}";
        if (!string.IsNullOrWhiteSpace(buscar))
        {
            var value = buscar.Trim().Replace("\\", "\\\\").Replace("\"", "\\\"")
                .Replace("%", "\\%").Replace("_", "\\_").Replace("*", "\\*");
            query += "&or=" + Uri.EscapeDataString($"(name.ilike.\"%{value}%\",sku.ilike.\"%{value}%\")");
        }
        return LeerAsync<Producto>(query, ct);
    }

    public Task<List<CatalogoOpcion>> MarcasAsync(CancellationToken ct) =>
        LeerAsync<CatalogoOpcion>("brands?select=id,name&order=id.asc", ct);
    public Task<List<CatalogoOpcion>> CategoriasAsync(CancellationToken ct) =>
        LeerAsync<CatalogoOpcion>("categories?select=id,name&order=id.asc", ct);
}
