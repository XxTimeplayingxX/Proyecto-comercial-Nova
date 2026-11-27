using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Nova.Dtos;
using Nova.Models;

namespace Nova.Infrastructure;

public sealed class SupabaseVentaException(HttpStatusCode status, string? code, string? reason) : Exception
{
    public HttpStatusCode Status { get; } = status;
    public string? Code { get; } = code;
    public string? Reason { get; } = reason;
}

public sealed record VentaRegistrada([property: JsonPropertyName("sale_id")] long SaleId,
    decimal Total, bool Replayed);

public sealed class SupabaseVentasService(IHttpClientFactory clients, IHttpContextAccessor accessor)
{
    private async Task<T> EnviarAsync<T>(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        var token = await accessor.HttpContext!.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(token)) throw new SupabaseVentaException(HttpStatusCode.Unauthorized, null, null);
        using var client = clients.CreateClient(SupabaseOptions.SectionName);
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body);
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            string? code = null, reason = null;
            try
            {
                using var error = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
                if (error.RootElement.TryGetProperty("code", out var c)) code = c.GetString();
                if (error.RootElement.TryGetProperty("message", out var m)) reason = m.GetString();
            }
            catch (JsonException) { }
            throw new SupabaseVentaException(response.StatusCode, code, reason);
        }
        return await response.Content.ReadFromJsonAsync<T>(ct) ?? throw new JsonException("Respuesta de ventas vacía.");
    }

    private static string Busqueda(string value) => value.Trim().Replace("\\", "\\\\")
        .Replace("\"", "\\\"").Replace("%", "\\%").Replace("_", "\\_").Replace("*", "\\*");

    public Task<List<Producto>> ProductosAsync(string? buscar, long? categoria, int pagina, CancellationToken ct)
    {
        var query = $"products?select=*,brands(id,name),categories(id,name)&is_active=eq.true&order=name.asc,id.asc&limit=9&offset={(pagina - 1L) * 8}";
        if (categoria.HasValue) query += $"&category_id=eq.{categoria.Value}";
        if (!string.IsNullOrWhiteSpace(buscar)) query += "&or=" + Uri.EscapeDataString($"(name.ilike.\"%{Busqueda(buscar)}%\",sku.ilike.\"%{Busqueda(buscar)}%\")");
        return EnviarAsync<List<Producto>>(HttpMethod.Get, query, null, ct);
    }

    public Task<List<ClienteVentaDto>> ClientesAsync(string? buscar, long? id, CancellationToken ct)
    {
        var query = "customers?select=id,name&order=name.asc,id.asc&limit=20";
        if (id.HasValue) query += $"&id=eq.{id.Value}";
        if (!string.IsNullOrWhiteSpace(buscar)) query += "&name=ilike." + Uri.EscapeDataString($"\"%{Busqueda(buscar)}%\"");
        return EnviarAsync<List<ClienteVentaDto>>(HttpMethod.Get, query, null, ct);
    }

    public async Task<VentaValidacionDto> ValidarAsync(ValidarVentaInput input, CancellationToken ct)
    {
        var ids = string.Join(',', input.Items.Select(x => x.ProductoId));
        var products = await EnviarAsync<List<Producto>>(HttpMethod.Get,
            $"products?select=*,brands(id,name),categories(id,name)&id=in.({ids})&limit=100", null, ct);
        var lookup = products.ToDictionary(p => p.Id);
        var lines = new List<VentaLineaDto>();
        var errors = new List<string>();
        if (input.ClienteId.HasValue && (await ClientesAsync(null, input.ClienteId, ct)).Count == 0)
            errors.Add("El cliente seleccionado no está disponible para tu perfil.");
        foreach (var item in input.Items)
        {
            if (!lookup.TryGetValue(item.ProductoId, out var product) || !product.IsActive)
            {
                errors.Add($"El producto {item.ProductoId} ya no está disponible.");
                continue;
            }
            if (product.Stock < item.Cantidad) errors.Add(product.Stock == 0
                ? $"{product.Name} no tiene existencias. No se puede vender."
                : $"Stock insuficiente para {product.Name}: solicitaste {item.Cantidad} y hay {product.Stock} unidades disponibles.");
            lines.Add(new(product.Id, product.Name, product.Sku, item.Cantidad, product.Stock,
                product.Price, product.Price * item.Cantidad, product.ImagePath));
        }
        return new(errors.Count == 0, lines.Sum(x => x.Subtotal), lines, errors);
    }

    public async Task<VentaRegistrada> RegistrarAsync(RegistrarVentaInput input, CancellationToken ct)
    {
        // Do not prevalidate retries: an already committed operation must reach the RPC's replay branch.
        var result = await EnviarAsync<VentaRegistrada>(HttpMethod.Post, "rpc/register_sale", new
        {
            p_request_id = input.RequestId, p_customer_id = input.ClienteId,
            p_items = input.Items.Select(x => new { product_id = x.ProductoId, quantity = x.Cantidad })
        }, ct);
        return result.SaleId > 0 && result.Total > 0 ? result : throw new JsonException("Venta sin confirmación válida.");
    }
}
