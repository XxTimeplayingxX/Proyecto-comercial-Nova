using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Nova.Dtos;

namespace Nova.Infrastructure;

public sealed class SupabaseDashboardService(IHttpClientFactory clients, IHttpContextAccessor accessor)
{
    private async Task<T?> ConsultarAsync<T>(string rpc, object body, CancellationToken ct)
    {
        var token = await accessor.HttpContext!.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(token)) throw new SupabaseCatalogoException(HttpStatusCode.Unauthorized);
        using var client = clients.CreateClient(SupabaseOptions.SectionName);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"rpc/{rpc}") { Content = JsonContent.Create(body) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw new SupabaseCatalogoException(response.StatusCode);
        return await response.Content.ReadFromJsonAsync<T>(ct);
    }

    public async Task<DashboardDto> ObtenerAsync(string periodo, int pagina, CancellationToken ct) =>
        await ConsultarAsync<DashboardDto>("nova_dashboard", new { p_period = periodo, p_page = pagina }, ct)
        ?? throw new JsonException("El dashboard no confirmó los datos.");

    public Task<DashboardVentaDetalle?> DetalleAsync(long id, CancellationToken ct) =>
        ConsultarAsync<DashboardVentaDetalle>("nova_dashboard_sale", new { p_id = id }, ct);
}
