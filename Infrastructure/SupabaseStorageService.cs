using System.Buffers.Binary;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;

namespace Nova.Infrastructure;

public sealed class ImagenProductoException(string message) : Exception(message);
public sealed class SupabaseStorageException(HttpStatusCode status) : Exception
{
    public HttpStatusCode Status { get; } = status;
}
public sealed record ImagenProductoSubida(string Ruta, string Url);

public sealed class SupabaseStorageService(IHttpClientFactory clients, IHttpContextAccessor accessor)
{
    public const string ClientName = "SupabaseStorage";
    public const string Bucket = "product-images";
    public const int MaxBytes = 5 * 1024 * 1024;

    public async Task<ImagenProductoSubida> SubirAsync(IFormFile archivo, CancellationToken ct)
    {
        if (archivo.Length is <= 0 or > MaxBytes)
            throw new ImagenProductoException("Selecciona una imagen de hasta 5 MB.");
        var type = archivo.ContentType.ToLowerInvariant();
        if (type is not ("image/jpeg" or "image/png" or "image/webp"))
            throw new ImagenProductoException("Solo se admiten imágenes JPEG, PNG y WebP.");

        await using var source = archivo.OpenReadStream();
        using var buffer = new MemoryStream();
        await source.CopyToAsync(buffer, ct);
        if (buffer.Length != archivo.Length || buffer.Length > MaxBytes)
            throw new ImagenProductoException("El tamaño del archivo no es válido.");
        var bytes = buffer.ToArray();
        var extension = DetectarFormato(bytes);
        if (extension is null || (extension switch { "jpg" => type != "image/jpeg", "png" => type != "image/png", _ => type != "image/webp" }))
            throw new ImagenProductoException("El contenido no corresponde a una imagen JPEG, PNG o WebP válida.");

        var context = accessor.HttpContext!;
        var token = await context.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(token) || !Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            throw new SupabaseStorageException(HttpStatusCode.Unauthorized);
        var path = $"catalogo/{userId:D}/{Guid.NewGuid():N}.{extension}";
        using var client = clients.CreateClient(ClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"object/{Bucket}/{path}")
        {
            Content = new ByteArrayContent(bytes)
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(type);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Add("x-upsert", "false");
        request.Headers.Add("cache-control", "max-age=3600");
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var status = response.StatusCode;
            try
            {
                using var error = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
                if (error.RootElement.TryGetProperty("statusCode", out var value)
                    && int.TryParse(value.ToString(), out var embedded) && embedded is 401 or 403)
                    status = (HttpStatusCode)embedded;
                if (error.RootElement.TryGetProperty("code", out var code) && code.GetString() == "AccessDenied")
                    status = HttpStatusCode.Forbidden;
            }
            catch (JsonException) { }
            throw new SupabaseStorageException(status);
        }
        var publicUrl = new Uri(client.BaseAddress!, $"object/public/{Bucket}/{path}").AbsoluteUri;
        return new(path, publicUrl);
    }

    private static string? DetectarFormato(ReadOnlySpan<byte> bytes)
    {
        // Validate format signatures/structure without trusting the filename or MIME header.
        if (bytes.Length >= 32 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff
            && bytes[^2] == 0xff && bytes[^1] == 0xd9) return "jpg";
        if (bytes.Length >= 45 && bytes[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })
            && bytes.Slice(12, 4).SequenceEqual("IHDR"u8)
            && BinaryPrimitives.ReadUInt32BigEndian(bytes.Slice(16, 4)) is > 0 and <= 8192
            && BinaryPrimitives.ReadUInt32BigEndian(bytes.Slice(20, 4)) is > 0 and <= 8192
            && bytes.Slice(bytes.Length - 8, 4).SequenceEqual("IEND"u8)) return "png";
        if (bytes.Length >= 20 && bytes[..4].SequenceEqual("RIFF"u8) && bytes.Slice(8, 4).SequenceEqual("WEBP"u8)
            && BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(4, 4)) == bytes.Length - 8
            && (bytes.Slice(12, 4).SequenceEqual("VP8 "u8) || bytes.Slice(12, 4).SequenceEqual("VP8L"u8) || bytes.Slice(12, 4).SequenceEqual("VP8X"u8))) return "webp";
        return null;
    }
}
