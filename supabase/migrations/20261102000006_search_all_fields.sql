-- ════════════════════════════════════════════════════════════════════════════
-- Pesquisa em todos os campos do vídeo: além de título, descrição, perfil, observações,
-- categoria, etiquetas e comentários, entram o link do Instagram (e o código da publicação),
-- a data de publicação (DD/MM/AAAA e AAAA-MM-DD) e os nomes das coleções em que o vídeo está.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.biblioteca_compose_search_all(
  p_video_id uuid, p_title text, p_description text, p_profile text, p_notes text, p_category_id uuid,
  p_instagram_url text, p_publish_date date
)
returns text
language sql
stable
set search_path = ''
as $$
  select public.biblioteca_norm(concat_ws(' ',
    p_title, p_description, p_profile, p_notes, p_instagram_url,
    to_char(p_publish_date, 'DD/MM/YYYY'), to_char(p_publish_date, 'YYYY-MM-DD'),
    (select c.name from public.biblioteca_categories c where c.id = p_category_id),
    (select string_agg(t.name, ' ') from public.biblioteca_video_tags vt join public.biblioteca_tags t on t.id = vt.tag_id where vt.video_id = p_video_id),
    (select string_agg(cm.content, ' ') from public.biblioteca_comments cm where cm.video_id = p_video_id),
    (select string_agg(co.name, ' ') from public.biblioteca_collection_videos cv join public.biblioteca_collections co on co.id = cv.collection_id where cv.video_id = p_video_id)
  ))
$$;

create or replace function public.biblioteca_videos_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := trim(coalesce(new.title, ''));
  new.instagram_url := trim(new.instagram_url);
  new.profile_name := nullif(trim(regexp_replace(coalesce(new.profile_name, ''), '^@+', '')), '');
  if tg_op = 'INSERT' then
    new.updated_at := now();
  elsif (new.title, new.instagram_url, new.description, new.thumbnail_url, new.profile_name, new.category_id,
         new.original_publish_date, new.notes, new.is_favorite, new.is_archived)
        is distinct from
        (old.title, old.instagram_url, old.description, old.thumbnail_url, old.profile_name, old.category_id,
         old.original_publish_date, old.notes, old.is_favorite, old.is_archived) then
    new.updated_at := now();
  end if;
  new.search_text := public.biblioteca_compose_search_all(
    new.id, new.title, new.description, new.profile_name, new.notes, new.category_id, new.instagram_url, new.original_publish_date);
  return new;
end;
$$;

-- Função antiga não é mais usada
drop function if exists public.biblioteca_compose_search(uuid, text, text, text, text, uuid);

-- Vídeo entra/sai de uma coleção: reindexa
create or replace function public.biblioteca_collection_videos_search()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.biblioteca_touch_video_search(array[coalesce(new.video_id, old.video_id)]);
  return null;
end;
$$;

create trigger biblioteca_collection_videos_search
  after insert or delete on public.biblioteca_collection_videos
  for each row execute function public.biblioteca_collection_videos_search();

-- Coleção renomeada: reindexa os vídeos dela
create or replace function public.biblioteca_collection_renamed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.biblioteca_touch_video_search(array(select video_id from public.biblioteca_collection_videos where collection_id = new.id));
  return null;
end;
$$;

create trigger biblioteca_collection_renamed
  after update of name on public.biblioteca_collections
  for each row when (old.name is distinct from new.name)
  execute function public.biblioteca_collection_renamed();

-- Reindexa os vídeos já cadastrados (search_text é recalculado pelo gatilho; updated_at não muda)
update public.biblioteca_videos set search_text = search_text;
