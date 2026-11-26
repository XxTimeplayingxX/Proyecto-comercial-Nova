using System.Globalization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace Nova.Infrastructure;

public static class NovaSessionPolicy
{
    public const int WarningSeconds = 120;
    public const int IdleSeconds = 180;
    public const int AbsoluteMinutes = 60;
    public const string LastActivityKey = "nova:last_activity";
    public const string TokenExpiryKey = "nova:token_expiry";

    public static void Start(AuthenticationProperties properties, DateTimeOffset tokenExpiry, DateTimeOffset now)
    {
        properties.IssuedUtc = now;
        properties.ExpiresUtc = tokenExpiry < now.AddMinutes(AbsoluteMinutes) ? tokenExpiry : now.AddMinutes(AbsoluteMinutes);
        properties.Items[TokenExpiryKey] = tokenExpiry.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        Touch(properties, now);
    }

    public static void Touch(AuthenticationProperties properties, DateTimeOffset now) =>
        properties.Items[LastActivityKey] = now.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);

    public static long? LastActivity(AuthenticationProperties properties) =>
        properties.Items.TryGetValue(LastActivityKey, out var raw) && long.TryParse(raw, out var stamp) ? stamp : null;

    public static bool IsExpired(AuthenticationProperties properties, DateTimeOffset now) =>
        properties.ExpiresUtc is not { } expiry || expiry <= now || LastActivity(properties) is not { } last
        || last > now.ToUnixTimeSeconds() + 60 || now.ToUnixTimeSeconds() - last >= IdleSeconds;

    public static async Task ValidateAsync(CookieValidatePrincipalContext context)
    {
        if (!IsExpired(context.Properties, DateTimeOffset.UtcNow)) return;
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }
}
