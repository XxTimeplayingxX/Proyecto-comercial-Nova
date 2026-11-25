-- Propuesta pendiente de despliegue en Supabase.
begin;
create or replace function public.get_inventory_summary()
returns jsonb language sql stable security invoker set search_path = '' as $$
select jsonb_build_object(
 'total_products',count(*),
 'available_products',count(*) filter(where stock>minimum_stock),
 'low_stock_products',count(*) filter(where stock>0 and stock<=minimum_stock),
 'out_of_stock_products',count(*) filter(where stock=0))
from public.products where is_active;
$$;
revoke all on function public.get_inventory_summary() from public,anon,authenticated;
grant execute on function public.get_inventory_summary() to authenticated;
create or replace view public.vw_product_catalog with (security_invoker=true) as
select p.id,p.sku,p.name,p.description,p.brand_id,b.name brand_name,p.category_id,c.name category_name,p.price,p.stock,p.minimum_stock,p.image_path,p.is_active,
case when not p.is_active then 'inactive' when p.stock=0 then 'out_of_stock' when p.stock<=p.minimum_stock then 'low_stock' else 'available' end stock_status
from public.products p join public.brands b on b.id=p.brand_id join public.categories c on c.id=p.category_id;
revoke all on public.vw_product_catalog from public,anon,authenticated;
grant select on public.vw_product_catalog to authenticated;
notify pgrst,'reload schema';
commit;
-- Verificar con usuario autenticado y perfil activo.
