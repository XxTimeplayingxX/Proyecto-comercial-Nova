-- Prueba del RPC existente; ejecutar el archivo completo en una sola sesión SQL.
-- Crea solo productos de prueba y revierte filas. Las secuencias pueden avanzar.
-- Requiere una sesión administrativa y un perfil admin activo existente.
-- Emula auth.uid(); NO sustituye una prueba HTTP con JWT ni carga concurrente.
begin;
set local statement_timeout = '20s';
do $test$
declare
  actor uuid; brand bigint; category bigint; p bigint; p2 bigint;
  req uuid := gen_random_uuid(); invalid_req uuid; result jsonb; replay jsonb;
  units integer; checks integer := 0;
begin
  select id into actor from public.profiles where role='admin' and is_active limit 1;
  select id into brand from public.brands where is_active limit 1;
  select id into category from public.categories where is_active limit 1;
  if actor is null or brand is null or category is null then
    raise exception 'Se requiere admin activo, marca y categoría activas para preparar la prueba.';
  end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  insert into public.products(brand_id,category_id,sku,name,price)
    values(brand,category,'QA-STOCK-'||gen_random_uuid(),'QA validación stock (rollback)',10) returning id into p;
  insert into public.products(brand_id,category_id,sku,name,price)
    values(brand,category,'QA-STOCK-'||gen_random_uuid(),'QA línea disponible (rollback)',10) returning id into p2;

  -- 1: stock cero no permite vender una unidad.
  invalid_req := gen_random_uuid();
  begin
    perform public.register_sale(invalid_req,null,jsonb_build_array(jsonb_build_object('product_id',p,'quantity',1)));
    raise exception 'FALLO: permitió vender con stock cero';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
  end;
  if exists(select 1 from public.sales where request_id=invalid_req)
    or exists(select 1 from public.stock_movements where product_id=p) then
    raise exception 'FALLO: quedaron escrituras de una venta rechazada';
  end if;
  checks := checks+1;

  -- Cargar inventario mediante el RPC autorizado, nunca PATCH de stock.
  perform public.adjust_stock(p,'entry',2,'QA transaccional: dos unidades');
  perform public.adjust_stock(p2,'entry',2,'QA transaccional: dos unidades');

  -- 2: solicitar tres cuando hay dos rechaza y no descuenta.
  invalid_req := gen_random_uuid();
  begin
    perform public.register_sale(invalid_req,null,jsonb_build_array(jsonb_build_object('product_id',p,'quantity',3)));
    raise exception 'FALLO: permitió vender tres con stock dos';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
  end;
  select stock into units from public.products where id=p;
  if units<>2 or exists(select 1 from public.sales where request_id=invalid_req) then
    raise exception 'FALLO: la venta rechazada alteró stock o dejó venta';
  end if;
  checks := checks+1;

  -- 3: vender exactamente dos llega a cero y usa el precio de la base.
  result := public.register_sale(req,null,jsonb_build_array(jsonb_build_object('product_id',p,'quantity',2)));
  select stock into units from public.products where id=p;
  if units<>0 or (result->>'total')::numeric<>20 or (result->>'replayed')::boolean
    or (select count(*) from public.sale_details where sale_id=(result->>'sale_id')::bigint)<>1
    or (select count(*) from public.stock_movements where product_id=p and movement_type='sale')<>1 then
    raise exception 'FALLO: venta válida inconsistente';
  end if;
  checks := checks+1;

  -- 4: recuperar esa misma venta con stock ahora cero no vuelve a descontar.
  replay := public.register_sale(req,null,jsonb_build_array(jsonb_build_object('product_id',p,'quantity',2)));
  if replay->>'sale_id' is distinct from result->>'sale_id' or not (replay->>'replayed')::boolean
    or (select stock from public.products where id=p)<>0
    or (select count(*) from public.stock_movements where product_id=p and movement_type='sale')<>1 then
    raise exception 'FALLO: recuperación duplicó o cambió la venta';
  end if;
  checks := checks+1;

  -- 5: mismo UUID con otro pedido no es una venta nueva.
  begin
    perform public.register_sale(req,null,jsonb_build_array(jsonb_build_object('product_id',p,'quantity',1)));
    raise exception 'FALLO: permitió reutilizar UUID con otro pedido';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'REQUEST_ID_REUSED' then raise; end if;
  end;
  checks := checks+1;

  -- 6: una línea válida y otra agotada revierten el pedido completo.
  -- El RPC recorre IDs en orden: p se creó antes que p2.
  -- Dejar p disponible y p2 agotado comprueba la reversión del descuento previo.
  perform public.adjust_stock(p2,'exit',2,'QA dejar segunda línea agotada');
  perform public.adjust_stock(p,'entry',2,'QA primera línea disponible');
  invalid_req := gen_random_uuid();
  begin
    perform public.register_sale(invalid_req,null,jsonb_build_array(
      jsonb_build_object('product_id',p,'quantity',1),
      jsonb_build_object('product_id',p2,'quantity',1)));
    raise exception 'FALLO: permitió pedido parcialmente agotado';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
  end;
  if (select stock from public.products where id=p)<>2
    or (select stock from public.products where id=p2)<>0
    or exists(select 1 from public.sales where request_id=invalid_req)
    or (select count(*) from public.stock_movements where product_id=p and movement_type='sale')<>1 then
    raise exception 'FALLO: el pedido fallido no se revirtió por completo';
  end if;
  checks := checks+1;
  if checks<>6 then raise exception 'FALLO: casos incompletos'; end if;
end $test$;
rollback;
select '6 casos RPC aprobados; transacción revertida; no es prueba HTTP/RLS ni concurrencia' as resultado;

