using System.Text.Json.Serialization;

namespace Nova.Dtos;

internal sealed record SupabaseLoginRequest(string Email, string Password);

public sealed record SupabaseLoginResponse(
    [property: JsonPropertyName("access_token")] string? AccessToken,
    [property: JsonPropertyName("expires_at")] long ExpiresAt,
    SupabaseLoginUser? User,
    [property: JsonPropertyName("expires_in")] long? ExpiresIn = null);

public sealed record SupabaseLoginUser(Guid Id, string? Email);
