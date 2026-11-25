# Productos — equivalencia SQL y API REST

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
