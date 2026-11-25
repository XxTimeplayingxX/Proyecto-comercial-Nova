using Microsoft.Extensions.Options;
using Nova.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddOptions<SupabaseOptions>()
    .BindConfiguration(SupabaseOptions.SectionName)
    .Validate(options => options.ProjectUrl is { IsAbsoluteUri: true, Scheme: "https" },
        "Configura Supabase:ProjectUrl con la URL HTTPS del proyecto.")
    .Validate(options => options.PublishableKey.StartsWith("sb_publishable_", StringComparison.Ordinal),
        "Configura Supabase:PublishableKey con una clave publicable.");

builder.Services.AddHttpClient(SupabaseOptions.SectionName, (services, client) =>
{
    var options = services.GetRequiredService<IOptions<SupabaseOptions>>().Value;
    client.BaseAddress = new Uri(options.ProjectUrl!, "/rest/v1/");
    client.DefaultRequestHeaders.Add("apikey", options.PublishableKey);
});

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.Run();
