-- ════════════════════════════════════════════════════════════════════════════
-- Legenda do Instagram salva traduzida para o português (instagram_caption).
-- A original fica em instagram_caption_original, com o idioma detectado em instagram_caption_lang.
-- Quando a legenda já é em português (ou a tradução falha), instagram_caption_original fica vazio.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.biblioteca_videos
  add column instagram_caption_original text check (char_length(instagram_caption_original) <= 30000),
  add column instagram_caption_lang text check (char_length(instagram_caption_lang) <= 10);

-- A pesquisa encontra pela tradução e pela original
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
    new.id, new.title, new.description, new.profile_name, new.notes, new.category_id, new.instagram_url,
    new.original_publish_date,
    concat_ws(' ', new.instagram_caption, new.instagram_caption_original),
    new.instagram_author_name);
  return new;
end;
$$;

-- A listagem da galeria devolve também a legenda original e o idioma
drop function if exists public.biblioteca_list_videos(jsonb, text, jsonb, integer);
create function public.biblioteca_list_videos(
  p_filters jsonb default '{}'::jsonb,
  p_sort text default 'recent',
  p_cursor jsonb default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  title text,
  instagram_url text,
  description text,
  thumbnail_url text,
  profile_name text,
  category_id uuid,
  original_publish_date date,
  notes text,
  is_favorite boolean,
  is_archived boolean,
  comments_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  instagram_caption text,
  instagram_caption_original text,
  instagram_caption_lang text,
  instagram_author_name text,
  instagram_like_count bigint,
  instagram_comment_count bigint,
  instagram_taken_at timestamptz,
  instagram_fetched_at timestamptz,
  category jsonb,
  tags jsonb,
  sort_key text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  key_expr text;
  dir text;
  cmp text;
  cast_to text;
  sql text;
begin
  case p_sort
    when 'oldest' then key_expr := 'v.created_at'; dir := 'asc'; cast_to := 'timestamptz';
    when 'title_asc' then key_expr := 'lower(v.title)'; dir := 'asc'; cast_to := 'text';
    when 'title_desc' then key_expr := 'lower(v.title)'; dir := 'desc'; cast_to := 'text';
    when 'updated' then key_expr := 'v.updated_at'; dir := 'desc'; cast_to := 'timestamptz';
    else key_expr := 'v.created_at'; dir := 'desc'; cast_to := 'timestamptz';
  end case;
  cmp := case dir when 'asc' then '>' else '<' end;

  sql := format($q$
    select v.id, v.title, v.instagram_url, v.description, v.thumbnail_url, v.profile_name, v.category_id,
           v.original_publish_date, v.notes, v.is_favorite, v.is_archived, v.comments_count, v.created_at, v.updated_at,
           v.instagram_caption, v.instagram_caption_original, v.instagram_caption_lang,
           v.instagram_author_name, v.instagram_like_count, v.instagram_comment_count,
           v.instagram_taken_at, v.instagram_fetched_at,
           (select jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color)
              from public.biblioteca_categories c where c.id = v.category_id),
           coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) order by lower(t.name))
                       from public.biblioteca_video_tags vt join public.biblioteca_tags t on t.id = vt.tag_id
                      where vt.video_id = v.id), '[]'::jsonb),
           (%1$s)::text
      from public.biblioteca_videos v
     where %2$s
       and ($2 is null or (%1$s, v.id) %3$s (($2->>'v')::%4$s, ($2->>'id')::uuid))
     order by %1$s %5$s, v.id %5$s
     limit $3
  $q$, key_expr, public.biblioteca_filter_sql(), cmp, cast_to, dir);

  return query execute sql using coalesce(p_filters, '{}'::jsonb), p_cursor, least(greatest(coalesce(p_limit, 24), 1), 100);
end;
$$;

revoke execute on function public.biblioteca_list_videos(jsonb, text, jsonb, integer) from anon, public;
grant execute on function public.biblioteca_list_videos(jsonb, text, jsonb, integer) to authenticated;
