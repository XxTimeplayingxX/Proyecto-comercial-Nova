using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;
using Nova.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true)
        .AddEnvironmentVariables()
        .AddCommandLine(args);
}

builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Login";
        options.Cookie.Name = "Nova.Session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.SlidingExpiration = false;
    });
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

builder.Services.AddHttpClient<SupabaseAuthService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(12);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    AllowAutoRedirect = false,
    UseCookies = false
});

var app = builder.Build();

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapRazorPages();
app.MapFallbackToPage("{**path}", "/NotFound")
    .WithMetadata(new HttpMethodMetadata(["GET", "HEAD"]));

app.Run();
