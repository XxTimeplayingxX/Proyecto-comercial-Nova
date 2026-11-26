namespace Nova.Infrastructure;

public sealed class SupabaseOptions
{
    public const string SectionName = "Supabase";

    public Uri? ProjectUrl { get; set; }
    public string PublishableKey { get; set; } = string.Empty;
    public string AuthAdminKey { get; set; } = string.Empty;
}
