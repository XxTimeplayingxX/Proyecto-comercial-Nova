begin;

create or replace function nova_private.nova_seller_directory()
returns table(id uuid, first_name text, last_name text, email text, role text,
              is_active boolean, sales_count bigint, total numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
    if coalesce(nova_private.active_role(), '') <> 'admin' then
        raise exception using errcode = '42501', message = 'ACCESS_DENIED';
    end if;
    return query
        select p.id, p.first_name, p.last_name, u.email::text, p.role, p.is_active,
               totals.sales_count, totals.total
        from public.profiles p
        join auth.users u on u.id = p.id
        cross join lateral (
            select count(*) as sales_count, coalesce(sum(s.total), 0) as total
            from public.sales s
            where s.seller_id = p.id and s.status = 'completed'
        ) totals;
end;
$$;

create or replace function nova_private.nova_link_seller(p_auth_id uuid, p_first_name text, p_last_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare seller_id uuid;
begin
    if coalesce(nova_private.active_role(), '') <> 'admin' then
        raise exception using errcode = '42501', message = 'ACCESS_DENIED';
    end if;
    if coalesce(char_length(btrim(p_first_name)), 0) not between 1 and 80
        or coalesce(char_length(btrim(p_last_name)), 0) not between 1 and 80 then
        raise exception using errcode = 'PT400', message = 'INVALID_NAME';
    end if;
    insert into public.profiles (id, first_name, last_name, role, is_active)
    select u.id, btrim(p_first_name), btrim(p_last_name), 'seller', true
    from auth.users u
    where u.id = p_auth_id and u.deleted_at is null
        and u.email_confirmed_at is not null and nullif(u.email, '') is not null
        and nullif(u.encrypted_password, '') is not null
    on conflict (id) do nothing
    returning id into seller_id;
    if seller_id is null then
        raise exception using errcode = 'PT409', message = 'AUTH_USER_UNAVAILABLE_OR_LINKED';
    end if;
    return seller_id;
end;
$$;

create or replace function public.nova_seller_directory()
returns table(id uuid, first_name text, last_name text, email text, role text,
              is_active boolean, sales_count bigint, total numeric)
language sql stable security invoker set search_path = ''
as $$ select * from nova_private.nova_seller_directory() $$;

create or replace function public.nova_link_seller(p_auth_id uuid, p_first_name text, p_last_name text)
returns uuid
language sql security invoker set search_path = ''
as $$ select nova_private.nova_link_seller(p_auth_id, p_first_name, p_last_name) $$;

revoke all on function nova_private.nova_seller_directory(), public.nova_seller_directory()
    from public, anon, authenticated;
revoke all on function nova_private.nova_link_seller(uuid, text, text), public.nova_link_seller(uuid, text, text)
    from public, anon, authenticated;
grant execute on function nova_private.nova_seller_directory(), public.nova_seller_directory()
    to authenticated;
grant execute on function nova_private.nova_link_seller(uuid, text, text), public.nova_link_seller(uuid, text, text)
    to authenticated;

notify pgrst, 'reload schema';
commit;
