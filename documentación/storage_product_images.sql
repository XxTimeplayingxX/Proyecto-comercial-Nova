-- Configuración aplicada el 2026-11-25 al proyecto Comercial Nova.
-- Registro de DDL, no una migración generada por Supabase CLI.
-- Revisar estado existente antes de reutilizar; CREATE POLICY no es idempotente.
begin;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy nova_product_images_admin_insert
on storage.objects for insert to authenticated
with check (
    bucket_id = 'product-images'
    and (select nova_private.active_role()) = 'admin'
    and (storage.foldername(name))[1] = 'catalogo'
    and (storage.foldername(name))[2] = (select auth.uid())::text
);

create policy nova_product_images_admin_select
on storage.objects for select to authenticated
using (bucket_id = 'product-images' and (select nova_private.active_role()) = 'admin');

commit;

-- No se crearon políticas UPDATE/DELETE ni se deshabilitó RLS.
-- Los archivos se cargan exclusivamente mediante Storage API, nunca por INSERT SQL.
