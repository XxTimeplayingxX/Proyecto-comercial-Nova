using System.Net;
using Microsoft.AspNetCore.Mvc;
using Nova.Dtos;
using Nova.Infrastructure;

namespace Nova.Controllers;

[Route("api/productos")]
public sealed class ProductosController(SupabaseCatalogoService catalogo) : CatalogoControllerBase
{
    [HttpPost("{id:long}/stock")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> AgregarStock(long id, [FromBody] StockEntradaInput input, CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (id <= 0) return Problem(statusCode: 400, title: "El identificador del producto no es válido.");
        if (!StockEntradaInput.Motivos.Contains(input.Motivo))
            return Problem(statusCode: 400, title: "Selecciona un motivo de ingreso válido.");
        try
        {
            var stock = await catalogo.AgregarStockAsync(id, input, ct);
            return Ok(new { id, stock });
        }
        catch (SupabaseCatalogoException ex) when (ex.Status == HttpStatusCode.Forbidden)
        {
            return Problem(statusCode: 403, title: "Solo un administrador con perfil activo puede agregar stock.");
        }
        catch (SupabaseCatalogoException ex) when (ex.Code == "PT409")
        {
            return Problem(statusCode: 409, title: "El producto ya no está disponible para registrar el ingreso.");
        }
        catch (SupabaseCatalogoException ex) when (ex.Code == "22003")
        {
            return Problem(statusCode: 409, title: "La cantidad supera el stock máximo admitido para este producto.");
        }
    });

    [HttpPatch("{id:long}")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Editar(long id, [FromBody] CrearProductoInput input, CancellationToken ct) => ConsultarAsync(async () =>
    {
        if (id <= 0) return BadRequest(new { title = "El identificador del producto no es válido." });
        try
        {
            var guardado = await catalogo.EditarAsync(id, input, ct);
            return Ok(new { id = guardado });
        }
        catch (SupabaseCatalogoException ex) when (ex.Status == System.Net.HttpStatusCode.NotFound)
        {
            return NotFound(new { title = "El producto no existe o tu perfil no tiene permiso para editarlo." });
        }
        catch (SupabaseCatalogoException ex) when (ex.Status == System.Net.HttpStatusCode.Forbidden)
        {
            return Problem(statusCode: 403, title: "Solo un administrador con perfil activo puede editar productos.");
        }
        catch (SupabaseCatalogoException ex) when (ex.Code == "23505")
        {
            return Problem(statusCode: 409, title: "Los datos entran en conflicto con otro producto. Actualiza el catálogo y revisa el registro.");
        }
        catch (SupabaseCatalogoException ex) when (ex.Code is "23503" or "23514" || ex.Status == System.Net.HttpStatusCode.BadRequest)
        {
            return Problem(statusCode: 400, title: "Revisa los datos y selecciona una marca y categoría válidas.");
        }
    });

    [HttpPost]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Crear([FromBody] CrearProductoInput input, CancellationToken ct) => ConsultarAsync(async () =>
    {
        try
        {
            var id = await catalogo.CrearAsync(input, ct);
            return Created($"/api/productos/{id}", new { id });
        }
        catch (SupabaseCatalogoException ex) when (ex.Code == "23505")
        {
            return Problem(statusCode: 409, title: "El código SKU ya está registrado. Usa otro código.");
        }
        catch (SupabaseCatalogoException ex) when (ex.Code is "23503" or "23514" || ex.Status == System.Net.HttpStatusCode.BadRequest)
        {
            return Problem(statusCode: 400, title: "Revisa los datos del producto y selecciona una marca y categoría válidas.");
        }
        catch (SupabaseCatalogoException ex) when (ex.Status == System.Net.HttpStatusCode.Forbidden)
        {
            return Problem(statusCode: 403, title: "Solo un administrador con perfil activo puede crear productos.");
        }
    });

    [HttpGet]
    public Task<IActionResult> Listar([FromQuery] string? buscar, [FromQuery] long? marca,
        [FromQuery] long? categoria, [FromQuery] string? estado, [FromQuery] int pagina = 1,
        [FromQuery] int tamano = 10, CancellationToken cancellationToken = default) => ConsultarAsync(async () =>
    {
        if (pagina < 1 || tamano is < 1 or > 100 || buscar?.Length > 120
            || (estado is not null and not "" and not "disponible" and not "bajo" and not "agotado" and not "inactivo"))
            return BadRequest(new { title = "Revisa los filtros o la paginación." });
        var productos = await catalogo.ProductosAsync(marca, categoria, buscar, null, cancellationToken);
        var filtrados = productos.Where(p => string.IsNullOrEmpty(estado) || p.Estado == estado).ToList();
        return Ok(new { total = filtrados.Count, pagina, tamano,
            items = filtrados.Skip((int)Math.Min((long)(pagina - 1) * tamano, int.MaxValue)).Take(tamano).Select(ProductoDto.DesdeModelo) });
    });
}
