using Microsoft.AspNetCore.Mvc;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Route("api/productos/filtros")]
public sealed class ProductosFiltroController(SupabaseCatalogoService catalogo) : CatalogoControllerBase
{
    [HttpGet]
    public Task<IActionResult> Obtener(CancellationToken ct) => ConsultarAsync(async () =>
        Ok(new { marcas = await catalogo.MarcasAsync(ct), categorias = await catalogo.CategoriasAsync(ct) }));
}
