# Productos — equivalencia SQL y API REST

## Implementación web actual: crear y editar

Actualización 2026-11-25. La tabla de `/Productos` ofrece íconos de detalle y edición. En escritorio aparecen desplazándose de derecha a izquierda al hacer hover o entrar con teclado, y se esconden al salir. En pantallas táctiles y anchos pequeños están siempre visibles; hasta 600 px la tabla se presenta como tarjetas. La animación respeta `prefers-reduced-motion`.

La edición usa el modal reutilizable del alta, precarga datos reales y mantiene SKU y stock como solo lectura. Permite modificar nombre, marca, categoría, descripción, estado, precio, stock mínimo e imagen por URL. Si la marca o categoría actual dejó de estar activa, se conserva como opción actual para no perder la asociación al guardar. La imagen admite vista previa; quitarla desvincula la referencia sin borrar archivos remotos.

| Método y ruta en Nova | Funcionamiento |
| --- | --- |
| `GET /api/productos/{id}` | Devuelve detalle, ahora también `descripcion`, `marcaId` y `categoriaId`. |
| `GET /api/productos/filtros?activos=true` | Opciones activas para el formulario. |
| `POST /api/productos` | Crea el producto; conserva el valor inicial de stock de la base. |
| `PATCH /api/productos/{id}` | Edita datos comerciales, sin enviar SKU ni stock a Supabase. |

POST y PATCH requieren cookie de sesión de Nova y cabecera `RequestVerificationToken` obtenida del formulario Razor en esa misma sesión. No se autentican con el bearer de Supabase directamente en el navegador. El servidor transmite el JWT de usuario a Supabase; solo administradores activos pueden escribir según RLS.

Cuerpo local completo del formulario (PATCH local recibe el formulario completo, no un parche parcial de un solo campo):

```json
{
  "nombre": "Consola de videojuegos",
  "sku": "CON-001",
  "categoriaId": 1,
  "marcaId": 1,
  "precio": 499.99,
  "stockMinimo": 5,
  "activo": true,
  "descripcion": "Descripción del producto",
  "imagen": null
}
```

`sku` es requerido por el DTO compartido; en edición se muestra de solo lectura y el servicio lo excluye de la escritura. `stock` no pertenece al DTO. Nombre: 3–200 caracteres; SKU: 1–80; descripción opcional hasta 250; precio mayor que cero y hasta dos decimales; mínimo entero no negativo; imagen opcional HTTPS o ruta local absoluta segura. Para ajustes de existencias usar `adjust_stock`.

El PATCH saliente es `/rest/v1/products?id=eq.{id}&select=id`, con `Prefer: return=representation`. Nova devuelve `200 {"id":...}` solo si se confirma una fila; `[]` devuelve 404 (inexistente o sin acceso), nunca éxito ficticio. Errores locales: 400 validación/antifalsificación/referencias, 401 sesión, 403 permisos, 404 producto no actualizado, 409 conflicto y 502/503 servicio externo. No hay reintentos automáticos. Tras confirmar el guardado se refrescan listado e indicadores, conservando los filtros.

Los ejemplos ejecutables y el flujo de login/cookie/antifalsificación están en la carpeta **Nova local — catálogo** de la colección Postman. [Storage y costos](Storage.md): bucket público `product-images` ya desplegado y carga local `POST /api/productos/imagen` integrada. Se pueden seleccionar archivos JPEG/PNG/WebP de hasta 5 MB; se suben al guardar y su URL se conserva si falla posteriormente la escritura del producto. No hay borrado ni sobrescritura automática de objetos.

Las secciones SQL/REST siguientes registran el estado de la base; la aplicación todavía consulta `products` y calcula KPI en C#, no consume aún la vista y el RPC de resumen.

Verificación de esta entrega: compilación sin errores ni advertencias con salida temporal para evitar los binarios en uso de la instancia abierta. En un host temporal con autenticación y Supabase simulados pasaron 17 casos HTTP de edición (200, 400, 401, 403, 404 y 409), incluido intento de enviar SKU/stock, desvinculación de imagen y conservación de ruta local. Se comprobaron DTO de detalle, cabeceras, filtro por ID, render Razor, sintaxis JavaScript y JSON/scripts de Postman. No se modificaron productos reales. Pendientes: inspección visual en navegador y escritura con sesión real autorizada.

Desplegado y verificado por SQL el 2026-11-25. HTTP con JWT real pendiente. No se modificaron datos. SQL Editor puede operar como administrador; la Data API aplica RLS y permisos del usuario.

## Conexión

```bash
BASE='https://eyxqkniyyctdzxlzslcb.supabase.co'
KEY='sb_publishable_xQotZnOhNRdR_GuwT5zPEQ_M6ocUILb'
TOKEN='TU_ACCESS_TOKEN'
```

Iniciar sesión según [README](README.md). Cada ejemplo usa GET y las cabeceras apikey y Authorization. No guardar JWT. Los ejemplos cURL son para Git Bash; en Postman importar la colección del repositorio.

## Contrato

La vista devuelve id, sku, name, description, brand_id, brand_name, category_id, category_name, price, stock, minimum_stock, image_path, is_active, stock_status. GET de vista/tablas devuelve array; detalle no encontrado devuelve []. KPI RPC devuelve objeto JSON. El filtro disponible excluye stock bajo; agotado es cero; inactivo tiene prioridad sobre otros estados. Los KPI son globales, no se recalculan al filtrar. Para edición, usar PATCH /products; para inventario, RPC adjust_stock.

## KPI global

SQL:
```sql
select public.get_inventory_summary();
```

REST: `GET /rest/v1/rpc/get_inventory_summary`

```bash
curl -i "$BASE/rest/v1/rpc/get_inventory_summary" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 10 total, 7 disponibles, 2 bajos, 1 agotado.

## Listado

SQL:
```sql
select * from public.vw_product_catalog where is_active order by id limit 10 offset 0;
```

REST: `GET /rest/v1/vw_product_catalog?is_active=eq.true&order=id.asc&limit=10&offset=0`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?is_active=eq.true&order=id.asc&limit=10&offset=0" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" -H 'Prefer: count=exact'
```

Resultado observado por SQL: 10 filas.

## Marcas

SQL:
```sql
select id,name from public.brands where is_active order by name;
```

REST: `GET /rest/v1/brands?select=id,name&is_active=eq.true&order=name.asc`

```bash
curl -i "$BASE/rest/v1/brands?select=id,name&is_active=eq.true&order=name.asc" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 9 filas.

## Categorías

SQL:
```sql
select id,name from public.categories where is_active order by name;
```

REST: `GET /rest/v1/categories?select=id,name&is_active=eq.true&order=name.asc`

```bash
curl -i "$BASE/rest/v1/categories?select=id,name&is_active=eq.true&order=name.asc" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 8 filas.

## Detalle

SQL:
```sql
select * from public.vw_product_catalog where id=1;
```

REST: `GET /rest/v1/vw_product_catalog?id=eq.1`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?id=eq.1" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: PlayStation 5 Slim, stock 1, low_stock.

## Marca Sony

SQL:
```sql
select * from public.vw_product_catalog where is_active and brand_id=1 order by id;
```

REST: `GET /rest/v1/vw_product_catalog?is_active=eq.true&brand_id=eq.1&order=id.asc`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?is_active=eq.true&brand_id=eq.1&order=id.asc" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 2 filas.

## Categoría Audio

SQL:
```sql
select * from public.vw_product_catalog where is_active and category_id=3 order by id;
```

REST: `GET /rest/v1/vw_product_catalog?is_active=eq.true&category_id=eq.3&order=id.asc`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?is_active=eq.true&category_id=eq.3&order=id.asc" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 2 filas.

## Búsqueda nombre o SKU

SQL:
```sql
select * from public.vw_product_catalog where is_active and (name ilike '%PS5%' or sku ilike '%PS5%') order by id;
```

REST: `GET /rest/v1/vw_product_catalog?is_active=eq.true&or=(name.ilike.*PS5*,sku.ilike.*PS5*)&order=id.asc`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?is_active=eq.true&or=(name.ilike.*PS5*,sku.ilike.*PS5*)&order=id.asc" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 1 fila.

## Estado available

SQL:
```sql
select * from public.vw_product_catalog where is_active and stock_status='available' order by id;
```

REST: `GET /rest/v1/vw_product_catalog?is_active=eq.true&stock_status=eq.available&order=id.asc`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?is_active=eq.true&stock_status=eq.available&order=id.asc" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 7 filas.

## Estado low_stock

SQL:
```sql
select * from public.vw_product_catalog where is_active and stock_status='low_stock' order by id;
```

REST: `GET /rest/v1/vw_product_catalog?is_active=eq.true&stock_status=eq.low_stock&order=id.asc`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?is_active=eq.true&stock_status=eq.low_stock&order=id.asc" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 2 filas.

## Estado out_of_stock

SQL:
```sql
select * from public.vw_product_catalog where is_active and stock_status='out_of_stock' order by id;
```

REST: `GET /rest/v1/vw_product_catalog?is_active=eq.true&stock_status=eq.out_of_stock&order=id.asc`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?is_active=eq.true&stock_status=eq.out_of_stock&order=id.asc" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 1 filas.

## Filtros combinados

SQL:
```sql
select * from public.vw_product_catalog where is_active and brand_id=1 and category_id=3 and stock_status='available' order by id;
```

REST: `GET /rest/v1/vw_product_catalog?is_active=eq.true&brand_id=eq.1&category_id=eq.3&stock_status=eq.available&order=id.asc`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?is_active=eq.true&brand_id=eq.1&category_id=eq.3&stock_status=eq.available&order=id.asc" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
```

Resultado observado por SQL: 1 fila.

## Segunda página

SQL:
```sql
select * from public.vw_product_catalog where is_active order by id limit 5 offset 5;
```

REST: `GET /rest/v1/vw_product_catalog?is_active=eq.true&order=id.asc&limit=5&offset=5`

```bash
curl -i "$BASE/rest/v1/vw_product_catalog?is_active=eq.true&order=id.asc&limit=5&offset=5" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" -H 'Prefer: count=exact'
```

Resultado observado por SQL: 5 filas.

## Respuestas de referencia

KPI: {"total_products":10,"available_products":7,"low_stock_products":2,"out_of_stock_products":1}

Detalle: [{"id":1,"sku":"PS5-001","name":"PlayStation 5 Slim","description":null,"brand_id":1,"brand_name":"Sony","category_id":1,"category_name":"Consolas","price":549.99,"stock":1,"minimum_stock":2,"image_path":null,"is_active":true,"stock_status":"low_stock"}]

Marcas/categorías: [{"id":1,"name":"Sony"}] (ejemplo de marca). Para paginar leer Content-Range con Prefer: count=exact; SQL equivalente al total es count(*) con los mismos filtros, sin limit ni offset. Orden estable por id.

## Verificación

Vista security_invoker=true; authenticated tiene SELECT y EXECUTE, anon no. RLS de tablas intacta. Asesor de seguridad reportó protección de contraseñas filtradas desactivada: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. No se cambió configuración Auth. Pendiente prueba HTTP con JWT válido y perfil activo; las imágenes aún pueden ser null.

## MVC

GET /Products/GetKpis, GetProducts, GetBrands, GetCategories y GetDetail son rutas MVC sugeridas, no implementadas aquí. Usar HttpClient con JWT del usuario en el servidor. El frontend no ejecuta SQL directamente. Cargar KPI/listado/selectores en paralelo; al cambiar filtros reiniciar offset; tras escritura refrescar KPI y listado.
