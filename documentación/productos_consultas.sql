-- Consultas de lectura. SQL Editor ejecuta con permisos administrativos; no equivale a una prueba HTTP autenticada.
-- KPI global
select public.get_inventory_summary();

-- Listado
select * from public.vw_product_catalog where is_active order by id limit 10 offset 0;

-- Marcas
select id,name from public.brands where is_active order by name;

-- Categorías
select id,name from public.categories where is_active order by name;

-- Detalle
select * from public.vw_product_catalog where id=1;

-- Marca Sony
select * from public.vw_product_catalog where is_active and brand_id=1 order by id;

-- Categoría Audio
select * from public.vw_product_catalog where is_active and category_id=3 order by id;

-- Búsqueda nombre o SKU
select * from public.vw_product_catalog where is_active and (name ilike '%PS5%' or sku ilike '%PS5%') order by id;

-- Estado available
select * from public.vw_product_catalog where is_active and stock_status='available' order by id;

-- Estado low_stock
select * from public.vw_product_catalog where is_active and stock_status='low_stock' order by id;

-- Estado out_of_stock
select * from public.vw_product_catalog where is_active and stock_status='out_of_stock' order by id;

-- Filtros combinados
select * from public.vw_product_catalog where is_active and brand_id=1 and category_id=3 and stock_status='available' order by id;

-- Segunda página
select * from public.vw_product_catalog where is_active order by id limit 5 offset 5;

-- Conteo filtrado para paginación
select count(*) from public.vw_product_catalog where is_active and brand_id=1;
