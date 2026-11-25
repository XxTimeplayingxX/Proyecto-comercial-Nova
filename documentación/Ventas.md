# Nueva venta — pantalla, contratos y validación

Actualizado: 2026-11-25. Ruta de pantalla: `/Ventas`, requiere sesión. No hay aún un historial/listado de ventas en Nova.

## Comportamiento implementado

La pantalla mantiene la tipografía Inter y los azules del proyecto. Catálogo de productos a la izquierda y resumen a la derecha en escritorio; resumen debajo del catálogo hasta 1100 px y tarjetas en una columna en teléfonos estrechos. La navegación compartida incorpora Ventas y usa un drawer modal hasta 900 px, con foco nativo, Escape, cierre por fondo y bloqueo del scroll. Se respeta movimiento reducido.

- Búsqueda por nombre o SKU con debounce de 300 ms y cancelación de solicitudes previas; no se ofrece búsqueda por código de barras porque ese campo no está documentado.
- Ocho skeletons por tarjeta tanto en el primer render como al cambiar búsqueda, categoría o página. Misma estructura y dimensiones de las tarjetas finales; estados vacío/error con reintento.
- Categorías activas desde `/api/productos/filtros?activos=true`. No se inventan cantidades por categoría ni mensajes de sincronización exitosa.
- Productos activos paginados de ocho en ocho, incluidos agotados con botón deshabilitado; controles de stock bajo y sin imagen.
- Carrito con cantidades enteras, incrementos, reducción, eliminación y límite según stock consultado. Los cambios invalidan la validación anterior. Las cantidades del resumen son reales; importes del navegador son orientativos.
- Búsqueda de clientes por nombre (máximo 20 coincidencias). Cliente opcional: consumidor final envía `null`. No se crean clientes desde esta pantalla.
- **Validar pedido** consulta precios, disponibilidad, existencias y cliente desde el servidor sin escribir ni reservar stock. Actualiza el resumen con los precios devueltos.
- **Confirmar venta** invoca el RPC existente `register_sale`. Solo después de un resultado válido se muestra número de venta, total confirmado y éxito. El total definitivo es el de Supabase; precios/stock pueden cambiar entre validación y registro.
- No se implementaron simulador, descuentos, desglose fiscal, cobro bancario ni impresión automática: no forman parte del contrato disponible.

## APIs locales nuevas

Todas requieren cookie `Nova.Session`; POST requiere `RequestVerificationToken` del formulario `venta-seguridad`, ligado a la misma sesión autenticada. No enviar JWT ni claves Supabase al JavaScript. El cliente HTTP del servidor envía la clave publicable configurada y el JWT del usuario.

| Método | Ruta | Entrada y salida |
| --- | --- | --- |
| GET | `/api/ventas/productos` | `buscar` opcional hasta 120 caracteres, `categoria` positiva opcional, `pagina` de 1 a 1000000. Devuelve `{items,pagina,hayMas}`. Ocho filas y una adicional para detectar siguiente página; orden estable `name.asc,id.asc`. |
| GET | `/api/ventas/clientes` | `buscar` opcional por nombre hasta 120 caracteres. Devuelve hasta 20 `{id,name}` visibles, sin otros datos personales. |
| POST | `/api/ventas/validar` | `clienteId` positivo o null, `items` de 1 a 100 productos distintos. Cada artículo exige `productoId` positivo y `cantidad` entera positiva. Devuelve `{valida,total,items,errores}`; HTTP 200 válido, 409 con errores de disponibilidad/stock/cliente. |
| POST | `/api/ventas` | Mismo pedido más `requestId`, UUID no vacío. Devuelve `{saleId,total,replayed}` con HTTP 200, incluyendo recuperaciones de operación. |

Cuerpo de validación:

```json
{
  "clienteId": null,
  "items": [{ "productoId": 1, "cantidad": 2 }]
}
```

Para registro, agregar `"requestId": "UUID-DE-LA-OPERACION"`. No enviar precios, subtotal, vendedor ni stock: la identidad sale de la sesión y el RPC toma los precios de la base. Los campos extra de precio/total del navegador no se transmiten al RPC.

Cada línea validada contiene `productoId,nombre,sku,cantidad,stock,precio,subtotal,imagen`. Si hay productos inexistentes/inactivos/no visibles, la respuesta incluye el error y no autoriza confirmar. La validación no sustituye las comprobaciones transaccionales finales.

Errores comunes: 400 campos, referencias, duplicados o antifalsificación; 401 sesión; 403 perfil; 409 stock o conflicto de UUID; 502/503 servicio externo o resultado no confirmado. Los errores de validación de ASP.NET pueden usar `ValidationProblemDetails`, mientras las incidencias de stock de `/validar` usan `errores`. Las respuestas externas no se exponen completas al cliente.

## RPC de Supabase existente y recuperación

Verificado mediante lectura de las definiciones de `public.register_sale` y `nova_private.register_sale` y del esquema de ventas/clientes. No se modificó SQL, permisos ni RLS. El wrapper público llama a la función privada existente; esta comprueba usuario y perfil activo admin/seller.

El backend envía `POST /rest/v1/rpc/register_sale`:

```json
{
  "p_request_id": "UUID-DE-LA-OPERACION",
  "p_customer_id": null,
  "p_items": [{ "product_id": 1, "quantity": 2 }]
}
```

La función existente controla el UUID mediante bloqueo transaccional, compara pedido/cliente/vendedor para recuperaciones, descuenta stock de productos activos y registra venta, detalle y movimientos. Si falla una línea, la transacción se revierte. Respuesta: `{sale_id,total,replayed}`. `INSUFFICIENT_STOCK` y `REQUEST_ID_REUSED` producen 409. La edición manual de `products.stock` no interviene en este flujo.

Al confirmar por primera vez, la pestaña guarda en `sessionStorage` el UUID, el pedido y una instantánea de las líneas, bajo una clave por usuario. No guarda JWT ni credenciales. Esto permite recuperar la operación al recargar la misma pestaña. Los borradores no enviados no se persisten.

- Durante envío se bloquean cambios, cliente y doble confirmación.
- Si la respuesta es incierta (red, 5xx o respuesta inválida), se conserva exactamente el pedido y UUID. El botón ofrece **Reintentar la misma venta**. No se hacen reintentos automáticos.
- La recuperación va directamente al RPC, sin validar stock otra vez: la venta pudo haberse confirmado y descontado existencias. El RPC devuelve `replayed:true` en lugar de vender nuevamente.
- Un rechazo definitivo 4xx permite corregir y validar de nuevo, salvo `REQUEST_ID_REUSED`, que conserva la operación para revisión. No cambiar su UUID automáticamente.
- Un éxito confirmado limpia el carrito y la instantánea, y refresca el catálogo. El comprobante mostrado es un registro de venta, no una factura fiscal.
- Si no se puede guardar la instantánea local, el envío inicial se bloquea. No cerrar la pestaña ni borrar almacenamiento mientras una operación esté sin confirmar; sessionStorage no sincroniza entre dispositivos.

## Archivos y mantenimiento

`Pages/Ventas.cshtml`, `Pages/Shared/_VentaProductoSkeleton.cshtml`, `wwwroot/css/ventas.css`, `wwwroot/js/ventas.js`, `Controllers/VentasController.cs`, `Dtos/VentaDto.cs` e `Infrastructure/SupabaseVentasService.cs`. Navegación: `_WorkspaceLayout`, `_WorkspaceNav`, `site.css` y `workspace.js`. Servicio registrado en `Program.cs`.

La carpeta **Nova local — ventas** de [Postman](Comercial_Nova.postman_collection.json) documenta cada API, el token y la variable `venta_request_id`. Su prerequest solo crea UUID si la variable está vacía: resolver el pedido anterior y vaciarla expresamente antes de una venta nueva.

## Verificación

Compilación en carpeta temporal: cero errores y advertencias. Host temporal con autenticación y Supabase simulados: 24 casos POST de validación/registro, incluidos precios manipulados ignorados, stock insuficiente, cliente/producto no disponible, artículos nulos/duplicados, longitudes, cantidades, antifalsificación, sesión, permisos, error externo, recuperación idempotente y conflicto de UUID. También se comprobaron búsqueda de clientes/productos, filtros inválidos, ocho skeletons en Razor y sintaxis JavaScript. No se registraron ventas ni se modificó inventario real.

Pendientes: prueba con sesión real autorizada, concurrencia real del RPC e inspección visual en navegador. El host de acceso al navegador no estuvo disponible durante esta entrega; no se afirma validación visual ni funcional del DOM en un navegador real.
