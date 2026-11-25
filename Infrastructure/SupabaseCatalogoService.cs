using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Nova.Models;
using Nova.Dtos;

namespace Nova.Infrastructure;

public sealed class SupabaseCatalogoException(HttpStatusCode status, string? code = null) : Exception
{
    public HttpStatusCode Status { get; } = status;
    public string? Code { get; } = code;
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

    public Task<List<CatalogoOpcion>> MarcasAsync(CancellationToken ct, bool activos = false) =>
        LeerAsync<CatalogoOpcion>("brands?select=id,name&order=id.asc" + (activos ? "&is_active=eq.true" : ""), ct);
    public Task<List<CatalogoOpcion>> CategoriasAsync(CancellationToken ct, bool activos = false) =>
        LeerAsync<CatalogoOpcion>("categories?select=id,name&order=id.asc" + (activos ? "&is_active=eq.true" : ""), ct);

    public async Task<long> CrearAsync(CrearProductoInput input, CancellationToken ct)
    {
        var token = await accessor.HttpContext!.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(token)) throw new SupabaseCatalogoException(HttpStatusCode.Unauthorized);
        using var client = clients.CreateClient(SupabaseOptions.SectionName);
        using var request = new HttpRequestMessage(HttpMethod.Post, "products?select=id")
        {
            Content = JsonContent.Create(new
            {
                category_id = input.CategoriaId, brand_id = input.MarcaId,
                sku = input.Sku.Trim(), name = input.Nombre.Trim(), price = input.Precio,
                minimum_stock = input.StockMinimo, is_active = input.Activo,
                description = string.IsNullOrWhiteSpace(input.Descripcion) ? null : input.Descripcion.Trim(),
                image_path = string.IsNullOrWhiteSpace(input.Imagen) ? null : input.Imagen.Trim()
                // Stock starts at its database default. Changes use inventory RPCs.
            })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Add("Prefer", "return=representation");
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            string? code = null;
            try
            {
                using var error = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
                if (error.RootElement.TryGetProperty("code", out var value)) code = value.GetString();
            }
            catch (JsonException) { /* Never expose upstream response bodies. */ }
            throw new SupabaseCatalogoException(response.StatusCode, code);
        }
        var rows = await response.Content.ReadFromJsonAsync<List<ProductoCreado>>(ct);
        return rows is { Count: 1 } && rows[0].Id > 0 ? rows[0].Id
            : throw new JsonException("Supabase no devolvió el producto creado.");
    }

    private sealed record ProductoCreado(long Id);
}
