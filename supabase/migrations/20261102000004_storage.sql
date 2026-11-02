-- ════════════════════════════════════════════════════════════════════════════
-- Armazenamento das capas (miniaturas). Cada usuário grava só na própria pasta: <user_id>/<arquivo>.
-- Leitura pública pelo endereço (nomes aleatórios), para a galeria carregar as imagens sem custo extra.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('biblioteca_thumbnails', 'biblioteca_thumbnails', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy biblioteca_thumbnails_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'biblioteca_thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy biblioteca_thumbnails_update on storage.objects for update to authenticated
  using (bucket_id = 'biblioteca_thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'biblioteca_thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy biblioteca_thumbnails_delete on storage.objects for delete to authenticated
  using (bucket_id = 'biblioteca_thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy biblioteca_thumbnails_select_own on storage.objects for select to authenticated
  using (bucket_id = 'biblioteca_thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
