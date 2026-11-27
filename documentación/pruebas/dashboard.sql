-- Solo lectura; identidad SQL emulada. No equivale a HTTP con JWT real.
begin;
set local statement_timeout='20s';
select set_config('nova.qa_admin',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
select set_config('nova.qa_seller',(select id::text from public.profiles where role='seller' and is_active limit 1),true);
set local role authenticated;
do $test$
declare data jsonb; chosen text; expected numeric; first_id bigint;
begin
  perform set_config('request.jwt.claim.sub',current_setting('nova.qa_admin'),true);
  foreach chosen in array array['hoy','semana','mes'] loop
    data := public.nova_dashboard(chosen,1);
    if data->>'period'<>chosen or jsonb_array_length(data->'daily')<>7 or jsonb_array_length(data->'topProducts')>3
      or jsonb_array_length(data->'recentSales')>5 then raise exception 'INVALID_SHAPE'; end if;
    select coalesce(sum(total),0) into expected from public.sales where status='completed'
      and created_at>=(data->>'from')::timestamptz and created_at<(data->>'to')::timestamptz;
    if (data->'summary'->>'salesTotal')::numeric<>expected then raise exception 'INVALID_TOTAL'; end if;
  end loop;
  if (data->'summary'->>'lowStockCount')::bigint<>(select count(*) from public.products where is_active and stock>0 and stock<=minimum_stock)
    then raise exception 'INVALID_STOCK'; end if;
  begin perform public.nova_dashboard('otro',1); raise exception 'FILTER_ACCEPTED';
    exception when sqlstate '22023' then null; end;
  begin perform public.nova_dashboard('semana',0); raise exception 'PAGE_ACCEPTED';
    exception when sqlstate '22023' then null; end;
  if jsonb_array_length(public.nova_dashboard('hoy',100000)->'recentSales')<>0 then raise exception 'PAGINATION_FAILED'; end if;
  select id into first_id from public.sales order by id desc limit 1;
  if first_id is not null then
    if public.nova_dashboard_sale(first_id)->>'id'<>first_id::text then raise exception 'DETAIL_FAILED'; end if;
  end if;
  if public.nova_dashboard_sale(9223372036854775807) is not null then raise exception 'NOT_FOUND_FAILED'; end if;
  begin perform public.nova_dashboard_sale(0); raise exception 'ID_ACCEPTED';
    exception when sqlstate '22023' then null; end;
  if nullif(current_setting('nova.qa_seller'),'') is null then raise exception 'SELLER_FIXTURE_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('nova.qa_seller'),true);
  begin perform public.nova_dashboard('semana',1); raise exception 'SELLER_DASHBOARD_ACCEPTED';
    exception when insufficient_privilege then null; end;
  begin perform public.nova_dashboard_sale(coalesce(first_id,1)); raise exception 'SELLER_DETAIL_ACCEPTED';
    exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin perform public.nova_dashboard('semana',1); raise exception 'MISSING_PROFILE_ACCEPTED';
    exception when insufficient_privilege then null; end;
  if has_function_privilege('anon','public.nova_dashboard(text,integer)','EXECUTE')
    or has_function_privilege('anon','public.nova_dashboard_sale(bigint)','EXECUTE') then raise exception 'ANON_GRANT'; end if;
end $test$;
rollback;
select 'Dashboard: periodos, total, stock, 7 días, límites, paginación, detalle y permisos comprobados; solo lectura' as resultado;

