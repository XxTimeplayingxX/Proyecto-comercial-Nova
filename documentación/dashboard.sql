-- DDL aplicado para el dashboard administrativo. No modifica ventas ni stock.
create or replace function public.nova_dashboard(p_period text default 'semana', p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $fn$
declare
  today date := (now() at time zone 'America/Guayaquil')::date;
  first_day date; start_at timestamptz; end_at timestamptz; output jsonb;
begin
  if auth.uid() is null or coalesce(nova_private.active_role(),'') <> 'admin' then
    raise exception using errcode='42501', message='ACCESS_DENIED';
  end if;
  if p_period is null or p_period not in ('hoy','semana','mes') or p_page is null or p_page < 1 or p_page > 100000 then
    raise exception using errcode='22023', message='INVALID_DASHBOARD_FILTER';
  end if;
  first_day := case p_period when 'hoy' then today when 'semana' then today - (extract(isodow from today)::integer - 1)
    else date_trunc('month',today)::date end;
  start_at := first_day::timestamp at time zone 'America/Guayaquil';
  end_at := (today+1)::timestamp at time zone 'America/Guayaquil';
  with period_sales as materialized (
    select s.* from public.sales s where s.created_at >= start_at and s.created_at < end_at
  ), ranked as (
    select p.id, p.name, p.price, c.name as category, sum(d.quantity) as units, sum(d.subtotal) as revenue
    from public.sale_details d join period_sales s on s.id=d.sale_id and s.status='completed'
    join public.products p on p.id=d.product_id left join public.categories c on c.id=p.category_id
    group by p.id,p.name,p.price,c.name order by sum(d.quantity) desc,p.id limit 3
  ), daily as (
    select (s.created_at at time zone 'America/Guayaquil')::date as day, sum(s.total) as amount
    from public.sales s where s.status='completed'
    and s.created_at >= (today-6)::timestamp at time zone 'America/Guayaquil' and s.created_at < end_at
    group by 1
  ), recent as (
    select s.id::text as id,s.created_at as date,s.total,s.status,
      coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Perfil no disponible') as seller
    from period_sales s left join public.profiles p on p.id=s.seller_id
    order by s.created_at desc,s.id desc limit 5 offset ((p_page-1)::bigint*5)
  )
  select jsonb_build_object(
    'period',p_period,'from',start_at,'to',end_at,'generatedAt',now(),'page',p_page,
    'summary',jsonb_build_object(
      'salesTotal',(select coalesce(sum(total),0) from period_sales where status='completed'),
      'salesCount',(select count(*) from period_sales where status='completed'),
      'productsCount',(select count(*) from public.products where is_active),
      'lowStockCount',(select count(*) from public.products where is_active and stock>0 and stock<=minimum_stock),
      'outOfStockCount',(select count(*) from public.products where is_active and stock=0)),
    'daily',(select jsonb_agg(jsonb_build_object('date',g.day::date,'amount',coalesce(d.amount,0)) order by g.day)
      from generate_series((today-6)::timestamp,today::timestamp,interval '1 day') g(day)
      left join daily d on d.day=g.day::date),
    'topProducts',coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'name',name,'price',price,'category',category,'units',units,'revenue',revenue) order by units desc,id) from ranked),'[]'::jsonb),
    'recentSales',coalesce((select jsonb_agg(to_jsonb(r) order by r.date desc,r.id::bigint desc) from recent r),'[]'::jsonb),
    'totalRows',(select count(*) from period_sales)
  ) into output;
  return output;
end $fn$;
revoke all on function public.nova_dashboard(text,integer) from public,anon;
grant execute on function public.nova_dashboard(text,integer) to authenticated;

create or replace function public.nova_dashboard_sale(p_id bigint)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $fn$
declare output jsonb;
begin
  if auth.uid() is null or coalesce(nova_private.active_role(),'') <> 'admin' then
    raise exception using errcode='42501', message='ACCESS_DENIED';
  end if;
  if p_id is null or p_id<=0 then raise exception using errcode='22023',message='INVALID_SALE_ID'; end if;
  select jsonb_build_object('id',s.id::text,'date',s.created_at,'total',s.total,'status',s.status,
    'seller',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Perfil no disponible'),
    'customer',coalesce(c.name,'Consumidor final'),
    'items',coalesce((select jsonb_agg(jsonb_build_object('name',coalesce(pr.name,'Producto no disponible'),
      'sku',pr.sku,'quantity',d.quantity,'price',d.unit_price,'subtotal',d.subtotal) order by d.id)
      from public.sale_details d left join public.products pr on pr.id=d.product_id where d.sale_id=s.id),'[]'::jsonb))
    into output from public.sales s left join public.profiles p on p.id=s.seller_id
    left join public.customers c on c.id=s.customer_id where s.id=p_id;
  return output;
end $fn$;
revoke all on function public.nova_dashboard_sale(bigint) from public,anon;
grant execute on function public.nova_dashboard_sale(bigint) to authenticated;

