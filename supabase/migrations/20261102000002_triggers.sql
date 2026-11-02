-- ════════════════════════════════════════════════════════════════════════════
-- Gatilhos: texto de busca, contagem de comentários, perfis de origem e datas
-- ════════════════════════════════════════════════════════════════════════════

-- Monta o texto de busca de um vídeo: campos próprios + categoria + etiquetas + comentários
create or replace function public.biblioteca_compose_search(
  p_video_id uuid, p_title text, p_description text, p_profile text, p_notes text, p_category_id uuid
)
returns text
language sql
stable
set search_path = ''
as $$
  select public.biblioteca_norm(concat_ws(' ',
    p_title, p_description, p_profile, p_notes,
    (select c.name from public.biblioteca_categories c where c.id = p_category_id),
    (select string_agg(t.name, ' ') from public.biblioteca_video_tags vt join public.biblioteca_tags t on t.id = vt.tag_id where vt.video_id = p_video_id),
    (select string_agg(cm.content, ' ') from public.biblioteca_comments cm where cm.video_id = p_video_id)
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
  new.search_text := public.biblioteca_compose_search(new.id, new.title, new.description, new.profile_name, new.notes, new.category_id);
  return new;
end;
$$;

create trigger biblioteca_videos_before_write
  before insert or update on public.biblioteca_videos
  for each row execute function public.biblioteca_videos_before_write();

-- Recalcula o texto de busca (o gatilho acima refaz search_text sem mexer em updated_at)
create or replace function public.biblioteca_touch_video_search(p_video_ids uuid[])
returns void
language sql
set search_path = ''
as $$
  update public.biblioteca_videos set search_text = search_text where id = any (p_video_ids)
$$;

-- Perfis de origem: todo perfil usado num vídeo entra na lista do usuário
create or replace function public.biblioteca_videos_after_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profile_name is not null and (tg_op = 'INSERT' or new.profile_name is distinct from old.profile_name) then
    insert into public.biblioteca_profiles (user_id, name) values (new.user_id, new.profile_name)
    on conflict (user_id, public.biblioteca_norm(name)) do nothing;
  end if;
  return null;
end;
$$;

create trigger biblioteca_videos_after_write
  after insert or update of profile_name on public.biblioteca_videos
  for each row execute function public.biblioteca_videos_after_write();

-- Etiquetas de um vídeo mudaram
create or replace function public.biblioteca_video_tags_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.biblioteca_touch_video_search(array[coalesce(new.video_id, old.video_id)]);
  return null;
end;
$$;

create trigger biblioteca_video_tags_changed
  after insert or delete or update on public.biblioteca_video_tags
  for each row execute function public.biblioteca_video_tags_changed();

-- Comentários: data de edição, contagem e texto de busca
create or replace function public.biblioteca_comments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger biblioteca_comments_before_update
  before update on public.biblioteca_comments
  for each row execute function public.biblioteca_comments_before_update();

create or replace function public.biblioteca_comments_after_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v uuid := coalesce(new.video_id, old.video_id);
begin
  -- O gatilho de vídeos refaz o texto de busca nesta mesma atualização
  update public.biblioteca_videos
     set comments_count = (select count(*) from public.biblioteca_comments c where c.video_id = v)
   where id = v;
  return null;
end;
$$;

create trigger biblioteca_comments_after_write
  after insert or delete or update of content on public.biblioteca_comments
  for each row execute function public.biblioteca_comments_after_write();

-- Nome de categoria ou etiqueta mudou: os vídeos ligados a ela são reindexados
create or replace function public.biblioteca_category_renamed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.biblioteca_touch_video_search(array(select id from public.biblioteca_videos where category_id = new.id));
  return null;
end;
$$;

create trigger biblioteca_category_renamed
  after update of name on public.biblioteca_categories
  for each row when (old.name is distinct from new.name)
  execute function public.biblioteca_category_renamed();

-- (Exclusões de etiqueta/categoria já reindexam pelo cascade em video_tags e pelo "set null" em vídeos)
create or replace function public.biblioteca_tag_renamed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.biblioteca_touch_video_search(array(select video_id from public.biblioteca_video_tags where tag_id = new.id));
  return null;
end;
$$;

create trigger biblioteca_tag_renamed
  after update of name on public.biblioteca_tags
  for each row when (old.name is distinct from new.name)
  execute function public.biblioteca_tag_renamed();

-- Datas de atualização
create or replace function public.biblioteca_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger biblioteca_collections_updated_at
  before update on public.biblioteca_collections
  for each row execute function public.biblioteca_set_updated_at();

-- Coleção ganha/perde vídeo: sobe na lista de coleções
create or replace function public.biblioteca_collection_videos_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.biblioteca_collections set updated_at = now() where id = coalesce(new.collection_id, old.collection_id);
  return null;
end;
$$;

create trigger biblioteca_collection_videos_changed
  after insert or delete on public.biblioteca_collection_videos
  for each row execute function public.biblioteca_collection_videos_changed();
