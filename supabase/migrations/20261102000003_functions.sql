-- ════════════════════════════════════════════════════════════════════════════
-- Funções (RPC) da biblioteca. Todas rodam com as permissões de quem chama
-- (security invoker): o RLS continua valendo.
-- ════════════════════════════════════════════════════════════════════════════

-- Condição SQL dos filtros (usada pela listagem e pela contagem). $1 = filtros (jsonb):
--   search, category_id, uncategorized, tag_ids[], untagged, favorites, archived, profile,
--   has_comments, created_from, created_to, published_from, published_to, collection_id
create or replace function public.biblioteca_filter_sql()
returns text
language sql
immutable
set search_path = ''
as $f$
  select $sql$
        v.user_id = (select auth.uid())
    and v.is_archived = coalesce(($1->>'archived')::boolean, false)
    and (($1->>'category_id') is null or v.category_id = ($1->>'category_id')::uuid)
    and (not coalesce(($1->>'uncategorized')::boolean, false) or v.category_id is null)
    and (not coalesce(($1->>'favorites')::boolean, false) or v.is_favorite)
    and (nullif(trim($1->>'profile'), '') is null or public.biblioteca_norm(v.profile_name) = public.biblioteca_norm(trim($1->>'profile')))
    and (($1->>'has_comments') is null or (v.comments_count > 0) = ($1->>'has_comments')::boolean)
    and (($1->>'created_from') is null or v.created_at >= ($1->>'created_from')::date)
    and (($1->>'created_to') is null or v.created_at < ($1->>'created_to')::date + 1)
    and (($1->>'published_from') is null or v.original_publish_date >= ($1->>'published_from')::date)
    and (($1->>'published_to') is null or v.original_publish_date <= ($1->>'published_to')::date)
    and (not coalesce(($1->>'untagged')::boolean, false)
         or not exists (select 1 from public.biblioteca_video_tags vt where vt.video_id = v.id))
    and (coalesce(jsonb_array_length($1->'tag_ids'), 0) = 0
         or (select count(distinct vt.tag_id) from public.biblioteca_video_tags vt
              where vt.video_id = v.id
                and vt.tag_id = any (array(select jsonb_array_elements_text($1->'tag_ids'))::uuid[]))
            = jsonb_array_length($1->'tag_ids'))
    and (($1->>'collection_id') is null
         or exists (select 1 from public.biblioteca_collection_videos cv
                     where cv.video_id = v.id and cv.collection_id = ($1->>'collection_id')::uuid))
    and v.search_text like all (public.biblioteca_search_patterns($1->>'search'))
  $sql$
$f$;

-- Cada palavra da pesquisa vira um padrão LIKE (todas precisam aparecer, em qualquer ordem)
create or replace function public.biblioteca_search_patterns(q text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg('%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'), array['%'])
    from unnest(regexp_split_to_array(public.biblioteca_norm(trim(coalesce(q, ''))), '\s+')) w
   where w <> ''
$$;

-- Listagem paginada por cursor. Ordenações: recent, oldest, title_asc, title_desc, updated.
-- O cursor é {"v": sort_key, "id": id} da última linha recebida (sort_key vem na própria linha).
create or replace function public.biblioteca_list_videos(
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

-- Quantidade total de resultados para os filtros (mostrada acima da galeria)
create or replace function public.biblioteca_count_videos(p_filters jsonb default '{}'::jsonb)
returns bigint
language plpgsql
stable
set search_path = ''
as $$
declare
  n bigint;
begin
  execute 'select count(*) from public.biblioteca_videos v where ' || public.biblioteca_filter_sql()
    into n using coalesce(p_filters, '{}'::jsonb);
  return n;
end;
$$;

-- Indicadores do painel inicial
create or replace function public.biblioteca_dashboard()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with mine as (
    select * from public.biblioteca_videos where user_id = (select auth.uid())
  )
  select jsonb_build_object(
    'videos', (select count(*) from mine where not is_archived),
    'archived', (select count(*) from mine where is_archived),
    'favorites', (select count(*) from mine where is_favorite and not is_archived),
    'categories', (select count(*) from public.biblioteca_categories where user_id = (select auth.uid())),
    'tags', (select count(*) from public.biblioteca_tags where user_id = (select auth.uid())),
    'collections', (select count(*) from public.biblioteca_collections where user_id = (select auth.uid())),
    'comments', (select count(*) from public.biblioteca_comments where user_id = (select auth.uid())),
    'added_last_7_days', (select count(*) from mine where created_at > now() - interval '7 days'),
    'top_categories', coalesce((
      select jsonb_agg(x order by x.video_count desc, x.name)
        from (select c.id, c.name, c.color, count(v.id) as video_count
                from public.biblioteca_categories c
                join mine v on v.category_id = c.id and not v.is_archived
               where c.user_id = (select auth.uid())
               group by c.id order by count(v.id) desc, c.name limit 6) x), '[]'::jsonb),
    'top_tags', coalesce((
      select jsonb_agg(x order by x.video_count desc, x.name)
        from (select t.id, t.name, t.color, count(v.id) as video_count
                from public.biblioteca_tags t
                join public.biblioteca_video_tags vt on vt.tag_id = t.id
                join mine v on v.id = vt.video_id and not v.is_archived
               where t.user_id = (select auth.uid())
               group by t.id order by count(v.id) desc, t.name limit 12) x), '[]'::jsonb)
  )
$$;

-- Listas com contagem de vídeos (views com security_invoker: valem as regras de quem consulta)
create or replace view public.biblioteca_categories_stats with (security_invoker = true) as
  select c.*, (select count(*) from public.biblioteca_videos v where v.category_id = c.id and not v.is_archived)::int as video_count
    from public.biblioteca_categories c;

create or replace view public.biblioteca_tags_stats with (security_invoker = true) as
  select t.*,
         (select count(*) from public.biblioteca_video_tags vt join public.biblioteca_videos v on v.id = vt.video_id
           where vt.tag_id = t.id and not v.is_archived)::int as video_count
    from public.biblioteca_tags t;

create or replace view public.biblioteca_collections_stats with (security_invoker = true) as
  select c.*,
         (select count(*) from public.biblioteca_collection_videos cv where cv.collection_id = c.id)::int as video_count,
         coalesce(c.cover_url, (
           select v.thumbnail_url from public.biblioteca_collection_videos cv
             join public.biblioteca_videos v on v.id = cv.video_id
            where cv.collection_id = c.id and v.thumbnail_url is not null
            order by cv.created_at desc limit 1)) as display_cover_url
    from public.biblioteca_collections c;

revoke all on public.biblioteca_categories_stats, public.biblioteca_tags_stats, public.biblioteca_collections_stats from anon;

-- Exclui a categoria, transferindo os vídeos para outra (ou deixando sem categoria)
create or replace function public.biblioteca_delete_category(p_id uuid, p_transfer_to uuid default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_transfer_to = p_id then
    raise exception 'A categoria de destino precisa ser outra.';
  end if;
  if p_transfer_to is not null and not exists (select 1 from public.biblioteca_categories where id = p_transfer_to) then
    raise exception 'Categoria de destino não encontrada.';
  end if;
  update public.biblioteca_videos set category_id = p_transfer_to where category_id = p_id;
  delete from public.biblioteca_categories where id = p_id;
end;
$$;

-- Nova ordem das categorias (lista de ids na ordem desejada)
create or replace function public.biblioteca_reorder_categories(p_ids uuid[])
returns void
language sql
set search_path = ''
as $$
  update public.biblioteca_categories c
     set position = o.pos
    from unnest(p_ids) with ordinality as o(id, pos)
   where c.id = o.id
$$;

-- Define exatamente as etiquetas de um vídeo
create or replace function public.biblioteca_set_video_tags(p_video_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.biblioteca_videos where id = p_video_id) then
    raise exception 'Vídeo não encontrado.';
  end if;
  delete from public.biblioteca_video_tags where video_id = p_video_id and not (tag_id = any (coalesce(p_tag_ids, '{}')));
  insert into public.biblioteca_video_tags (video_id, tag_id)
  select p_video_id, t from unnest(coalesce(p_tag_ids, '{}')) t
  on conflict (video_id, tag_id) do nothing;
end;
$$;

revoke execute on function
  public.biblioteca_list_videos(jsonb, text, jsonb, integer),
  public.biblioteca_count_videos(jsonb),
  public.biblioteca_dashboard(),
  public.biblioteca_delete_category(uuid, uuid),
  public.biblioteca_reorder_categories(uuid[]),
  public.biblioteca_set_video_tags(uuid, uuid[])
  from anon, public;
grant execute on function
  public.biblioteca_list_videos(jsonb, text, jsonb, integer),
  public.biblioteca_count_videos(jsonb),
  public.biblioteca_dashboard(),
  public.biblioteca_delete_category(uuid, uuid),
  public.biblioteca_reorder_categories(uuid[]),
  public.biblioteca_set_video_tags(uuid, uuid[])
  to authenticated;
