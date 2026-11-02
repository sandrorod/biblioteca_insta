-- Filtro por etiquetas usa o índice de video_tags (antes contava etiqueta por etiqueta, vídeo a vídeo).
-- Mesmo resultado: vídeos com TODAS as etiquetas escolhidas.
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
         or v.id in (select vt.video_id from public.biblioteca_video_tags vt
                      where vt.tag_id = any (array(select jsonb_array_elements_text($1->'tag_ids'))::uuid[])
                      group by vt.video_id
                     having count(distinct vt.tag_id) = jsonb_array_length($1->'tag_ids')))
    and (($1->>'collection_id') is null
         or exists (select 1 from public.biblioteca_collection_videos cv
                     where cv.video_id = v.id and cv.collection_id = ($1->>'collection_id')::uuid))
    and v.search_text like all (public.biblioteca_search_patterns($1->>'search'))
  $sql$
$f$;
