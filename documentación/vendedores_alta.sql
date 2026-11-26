begin;

create or replace function nova_private.nova_complete_staff_account(
    p_id uuid, p_first_name text, p_last_name text, p_role text, p_active boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
begin
    if coalesce(nova_private.active_role(), '') <> 'admin' then
        raise exception using errcode = '42501', message = 'ACCESS_DENIED';
    end if;
    if coalesce(char_length(btrim(p_first_name)), 0) not between 1 and 80
        or coalesce(char_length(btrim(p_last_name)), 0) not between 1 and 80
        or p_role is null or p_role not in ('admin', 'seller') or p_active is null then
        raise exception using errcode = 'PT400', message = 'INVALID_PROFILE';
    end if;
    insert into public.profiles (id, first_name, last_name, role, is_active)
    select u.id, btrim(p_first_name), btrim(p_last_name), p_role, p_active
      from auth.users u
     where u.id = p_id and u.deleted_at is null and u.email_confirmed_at is not null
       and u.raw_app_meta_data->>'nova_alta_por' = auth.uid()::text
    on conflict (id) do nothing;
    if not exists (
        select 1 from public.profiles p join auth.users u on u.id = p.id
        where p.id = p_id and p.first_name = btrim(p_first_name) and p.last_name = btrim(p_last_name)
          and p.role = p_role and p.is_active = p_active and u.deleted_at is null
          and u.raw_app_meta_data->>'nova_alta_por' = auth.uid()::text
    ) then
        raise exception using errcode = 'PT409', message = 'PROFILE_UNAVAILABLE_OR_CHANGED';
    end if;
    return p_id;
end;
$$;

create or replace function public.nova_complete_staff_account(
    p_id uuid, p_first_name text, p_last_name text, p_role text, p_active boolean)
returns uuid language sql security invoker set search_path = ''
as $$ select nova_private.nova_complete_staff_account(p_id, p_first_name, p_last_name, p_role, p_active) $$;

revoke all on function public.nova_complete_staff_account(uuid, text, text, text, boolean),
    nova_private.nova_complete_staff_account(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.nova_complete_staff_account(uuid, text, text, text, boolean),
    nova_private.nova_complete_staff_account(uuid, text, text, text, boolean) to authenticated;

create or replace function public.nova_update_staff_profile(
    p_id uuid, p_first_name text, p_last_name text, p_role text, p_active boolean)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare updated_id uuid;
begin
    perform pg_advisory_xact_lock(142008, 1);
    if p_id = auth.uid() or not exists (
        select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active
    ) then
        raise exception using errcode = '42501', message = 'ACCESS_DENIED';
    end if;
    if coalesce(char_length(btrim(p_first_name)), 0) not between 1 and 80
        or coalesce(char_length(btrim(p_last_name)), 0) not between 1 and 80
        or p_role is null or p_role not in ('admin', 'seller') or p_active is null then
        raise exception using errcode = 'PT400', message = 'INVALID_PROFILE';
    end if;
    update public.profiles set first_name = btrim(p_first_name), last_name = btrim(p_last_name),
        role = p_role, is_active = p_active
     where id = p_id returning id into updated_id;
    if updated_id is null then
        raise exception using errcode = 'PT404', message = 'PROFILE_NOT_FOUND';
    end if;
    return updated_id;
end;
$$;

revoke all on function public.nova_update_staff_profile(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.nova_update_staff_profile(uuid, text, text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
