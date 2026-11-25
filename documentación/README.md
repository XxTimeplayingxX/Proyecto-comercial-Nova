# Comercial Nova — API

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
