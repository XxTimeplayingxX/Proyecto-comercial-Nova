using Microsoft.AspNetCore.Mvc;
using Nova.Dtos;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Route("api/productos/{id:long}")]
public sealed class ProductoDetalleController(SupabaseCatalogoService catalogo) : CatalogoControllerBase
{
    [HttpGet]
    public Task<IActionResult> Obtener(long id, CancellationToken ct) => ConsultarAsync(async () =>
    {
        var producto = (await catalogo.ProductosAsync(null, null, null, id, ct)).SingleOrDefault();
        return producto is null ? NotFound(new { title = "El producto no existe o no está disponible para tu perfil." })
            : Ok(ProductoDto.DesdeModelo(producto));
    });
}
