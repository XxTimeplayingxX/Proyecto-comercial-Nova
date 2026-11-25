using System.Net;
using Microsoft.Extensions.Options;
using Nova.Dtos;

namespace Nova.Infrastructure;

public sealed class SupabaseAuthService(
    HttpClient httpClient, IOptions<SupabaseOptions> options, ILogger<SupabaseAuthService> logger)
{
    public async Task<SupabaseLoginResponse?> SignInAsync(
        string email, string password, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var endpoint = new Uri(settings.ProjectUrl!, "/auth/v1/token?grant_type=password");
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = JsonContent.Create(new SupabaseLoginRequest(email.Trim(), password))
        };
        request.Headers.Add("apikey", settings.PublishableKey);
        using var response = await httpClient.SendAsync(request, cancellationToken);

        if (response.StatusCode != HttpStatusCode.OK)
        {
            logger.LogInformation("Supabase Auth devolvió HTTP {StatusCode}.", (int)response.StatusCode);
            if (response.StatusCode is not HttpStatusCode.BadRequest and not HttpStatusCode.Unauthorized
                and not HttpStatusCode.UnprocessableEntity)
                response.EnsureSuccessStatusCode();
            return null;
        }

        return await response.Content.ReadFromJsonAsync<SupabaseLoginResponse>(cancellationToken);
    }
}
