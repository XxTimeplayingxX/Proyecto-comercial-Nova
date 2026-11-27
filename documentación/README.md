# Comercial Nova — API

## Dashboard administrativo

`GET /api/dashboard?periodo=semana&pagina=1` y `GET /api/dashboard/ventas/{id}` requieren cookie Nova y rol admin. RPC desplegados `nova_dashboard` y `nova_dashboard_sale`, de lectura y con perfil admin activo. DDL en `dashboard.sql`; carpeta **Dashboard administrativo** de Postman. [Periodo, conteos, detalle, diferencias de rol, tour y pruebas](Dashboard.md). El tour solo se abre al pulsar **¿Primera vez por aquí?** y no agrega API.

## Caso académico y defensa

[Revisión de la matriz Excel de QA](Revision_matriz_QA.md): conciliación de 50 casos, brechas prioritarias, propuestas QA-051–060 y ajustes de evidencia, conteos y trazabilidad. Análisis del archivo recibido el 2026-11-27, sin modificarlo ni reejecutar sus escenarios.

[Resolución práctica de los seis problemas](Resolucion_casos.md), actualizada el 2026-11-27: stock y toasts implementados, pruebas focalizadas y propuestas para concurrencia de edición, QA y móvil.

[Matriz de relación con el caso de estudio](Caso_de_estudio.md): diagnóstico, seis problemas, arquitectura, POO/MVC, alternativas tecnológicas y evidencia disponible. [Guía de sustentación](Defensa_del_proyecto.md): guion, demostración, respuestas a las cuatro preguntas del PDF y preparación previa a GitHub. Revisión del 2026-11-26 sin escrituras remotas ni publicación. No confundir pruebas simuladas con concurrencia real; la edición comercial de productos aún carece de control de versión.

## Sesión y navegación

`GET /api/sesion` devuelve perfil propio y metadatos de expiración, sin JWT. `POST /api/sesion/actividad` requiere cookie y antifalsificación y actualiza la última actividad sin extender la expiración absoluta. Aviso a 2 minutos, cierre a 3 minutos y sesión Nova de hasta 60 minutos o el vencimiento anterior del JWT. No se modificó el tiempo de token remoto. [Contrato y comprobaciones](Sesion.md); ejemplos en **Nova local — sesión** de Postman.

## Vendedores y trazabilidad

`/Vendedores/Nuevo` y `/Vendedores/Editar/{id}` administran credenciales, perfil, estado y rol. La edición incluye ventas completadas y comprobantes. El servidor usa `Supabase__AuthAdminKey` únicamente para Auth Admin. [Contratos y configuración](Vendedores.md#alta-y-edición-desde-nova).

`/Vendedores` administra perfiles comerciales y usa el mismo login de Nova para administradores y vendedores activos. [Alta en Supabase Auth, vinculación y contratos locales](Vendedores.md). La acción **Ver trazabilidad** en **Productos** consulta altas, movimientos y ventas. [Contrato y alcance del historial](Trazabilidad.md).

## Nueva venta

Pantalla `/Ventas` y APIs locales `GET /api/ventas/productos`, `GET /api/ventas/clientes`, `POST /api/ventas/validar` y `POST /api/ventas`. Se apoyan en consultas reales y en `rpc/register_sale` ya existente. Cookie de Nova y antifalsificación para POST; token Supabase solo en servidor. [Contrato, estados, recuperación y pruebas](Ventas.md). Ejemplos completos en **Nova local — ventas** de la colección JSON. No se modificaron funciones SQL ni se ejecutaron ventas reales en esta entrega.

## API local y edición de productos

La colección Postman también incluye **Nova local — catálogo**, con login mediante cookie, obtención del token antifalsificación y las rutas de detalle, selectores, creación y edición de ASP.NET. La API nueva `PATCH /api/productos/{id}` recibe el formulario completo y escribe campos comerciales mediante `PATCH /rest/v1/products?id=eq.ID&select=id`; nunca escribe stock ni SKU. Requiere administrador activo por RLS. Ver [contrato, respuestas y errores](Productos.md#implementación-web-actual-crear-y-editar).

Imágenes y precios: [Storage.md](Storage.md). Bucket público `product-images` desplegado el 2026-11-25, hasta 5 MB en JPEG/PNG/WebP, carga restringida a administradores activos por RLS. API local `POST /api/productos/imagen` integrada en creación/edición, con sesión y antifalsificación. No hay sobrescrituras ni borrado automático de objetos. Ver DDL y ejemplos en la carpeta **Storage — imágenes de productos** de Postman. Validación remota por SQL y pruebas locales con Storage simulado; prueba HTTP con JWT real pendiente.

**Agregar stock** está disponible en las acciones de cada producto. La API local `POST /api/productos/{id}/stock` usa la cookie y el token antifalsificación de Nova y llama al RPC `adjust_stock` con el JWT del administrador activo. [Contrato y recuperación ante un resultado incierto](Productos.md#agregar-stock).

Documentar toda API nueva o modificada en esta colección JSON junto con su implementación, incluyendo autenticación, parámetros, cuerpos y errores. Las rutas locales con cookie no deben confundirse con endpoints de Supabase autenticados con JWT.

Fuente de verdad versionada. Actualización: 2026-11-25.

## Conexión
En Git Bash:
```bash
BASE='https://eyxqkniyyctdzxlzslcb.supabase.co'
KEY='sb_publishable_xQotZnOhNRdR_GuwT5zPEQ_M6ocUILb'
curl -X POST "$BASE/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H 'Content-Type: application/json' -d '{"email":"TU_CORREO","password":"TU_PASSWORD"}'
```
Copiar access_token a TOKEN local. Se requiere usuario Auth y perfil activo (admin o seller). Nunca publicar contraseñas, JWT ni claves privilegiadas.

```bash
curl -i "$BASE/rest/v1/products?select=*,brands(id,name),categories(id,name)&is_active=eq.true&order=id.asc&limit=10&offset=0" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" -H 'Prefer: count=exact'
```

## Contratos existentes
Prefijo /rest/v1; GET devuelve arrays. POST/PATCH de tablas: Prefer: return=representation. Escrituras de catálogos y perfiles solo admin. Vendedores ven sus propias ventas.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | /products | Productos y relaciones |
| GET | /brands | Marcas |
| GET | /categories | Categorías |
| GET | /customers | Clientes |
| GET | /profiles | Perfiles visibles |
| GET | /sales | Ventas visibles |
| GET | /sale_details | Detalles |
| GET | /stock_movements | Movimientos (admin) |
| POST/PATCH | /products, /brands, /categories, /customers | Filas creadas/actualizadas |
| PATCH | /profiles?id=eq.UUID | Perfil actualizado |
| POST | /rpc/register_sale | sale_id,total,replayed |
| POST | /rpc/adjust_stock | product_id,stock |
| POST | /rpc/get_dashboard_summary | Indicadores ventas |
| POST | /rpc/get_top_products | Productos vendidos |
| POST | /rpc/get_seller_statistics | Estadísticas vendedores |

Venta: {"p_request_id":"550e8400-e29b-41d4-a716-446655440000","p_customer_id":null,"p_items":[{"product_id":1,"quantity":1}]}. UUID nuevo por venta, mismo UUID para reintento. HTTP 409 INSUFFICIENT_STOCK si falta stock.
Ajuste: {"p_product_id":1,"p_movement_type":"entry","p_quantity":1,"p_reason":"Prueba"}. Solo admin.
Dashboard: {"p_from":"2026-11-01T00:00:00-05:00","p_to":"2026-12-01T00:00:00-05:00"}. Fin exclusivo.
Escrituras solo con datos de prueba. No modificar stock directamente.

## Productos
Filtros: brand_id=eq.1, category_id=eq.1, or=(name.ilike.*PS5*,sku.ilike.*PS5*), stock=gt.0, stock=eq.0, is_active=eq.true.
Paginación limit/offset, orden id.asc, total en Content-Range con Prefer: count=exact. stock>0 incluye stock bajo.

## Pantalla Productos — desplegada en Supabase

Consulta comparativa SQL / REST, cURL y resultados: [Productos.md](Productos.md). Consultas ejecutables: [productos_consultas.sql](productos_consultas.sql). DDL aplicado: [inventario.sql](inventario.sql).

- GET o POST /rest/v1/rpc/get_inventory_summary: KPI globales del catálogo activo.
- GET /rest/v1/vw_product_catalog: listado, filtros combinables, detalle por ID y estado calculado.
- GET /rest/v1/brands y /categories: selectores activos.
- Verificado mediante SQL el 2026-11-25: 10 productos, 7 disponibles, 2 con stock bajo, 1 agotado; 9 marcas y 8 categorías.
- Permisos SQL verificados: authenticated puede consultar vista y ejecutar RPC, anon no; vista security_invoker.
- Pruebas HTTP con JWT real pendientes. No se modificaron productos ni existencias.
- KPI globales no cambian con filtros; el listado usa limit/offset y Prefer: count=exact.
- Storage e imágenes pendientes; image_path puede ser null.

## Mantenimiento
Actualizar esta documentación y colección Postman junto a cada cambio de API. Distinguir propuesta, despliegue y prueba. No guardar HTML separados por consulta. Mantener controladores MVC delgados; token de usuario en servidor, no en JavaScript.
