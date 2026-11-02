-- ════════════════════════════════════════════════════════════════════════════
-- #hashtags da descrição e da legenda do Instagram viram etiquetas do vídeo.
-- Usa a etiqueta existente (sem diferenciar maiúsculas/acentos) ou cria uma nova.
-- Só entram hashtags NOVAS no texto: uma etiqueta removida pelo usuário não volta
-- ao editar outra parte do vídeo.
-- ════════════════════════════════════════════════════════════════════════════

-- Hashtags de um texto (sem o #), sem repetição; ignora as só de números e as longas demais
create or replace function public.biblioteca_hashtags(p_text text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  -- Mesma hashtag com outra grafia (#Edição/#edicao): fica a primeira que aparece
  select coalesce(array_agg(tag order by pos), '{}')
    from (
      select distinct on (public.biblioteca_norm(m[1])) m[1] as tag, ord as pos
        from regexp_matches(coalesce(p_text, ''), '(?:^|[^[:alnum:]_&])#([[:alnum:]_]+)', 'g') with ordinality as r(m, ord)
       where m[1] !~ '^[0-9_]+$' and char_length(m[1]) <= 60
       order by public.biblioteca_norm(m[1]), ord
    ) t
$$;

create or replace function public.biblioteca_videos_hashtags()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  palette text[] := array['#ef4444','#f97316','#f59e0b','#84cc16','#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#d946ef','#ec4899'];
  new_tags text[];
  old_tags text[] := '{}';
begin
  new_tags := public.biblioteca_hashtags(concat_ws(' ', new.description, new.instagram_caption, new.instagram_caption_original));
  if tg_op = 'UPDATE' then
    old_tags := public.biblioteca_hashtags(concat_ws(' ', old.description, old.instagram_caption, old.instagram_caption_original));
  end if;
  -- Só as que não estavam no texto antes
  new_tags := array(
    select t from unnest(new_tags) t
     where not exists (select 1 from unnest(old_tags) o where public.biblioteca_norm(o) = public.biblioteca_norm(t))
  );
  if cardinality(new_tags) = 0 then
    return null;
  end if;

  insert into public.biblioteca_tags (user_id, name, color)
  select new.user_id, t, palette[1 + (abs(hashtext(public.biblioteca_norm(t))) % array_length(palette, 1))]
    from unnest(new_tags) t
  on conflict (user_id, public.biblioteca_norm(name)) do nothing;

  insert into public.biblioteca_video_tags (video_id, tag_id)
  select new.id, tg.id
    from public.biblioteca_tags tg
   where tg.user_id = new.user_id
     and public.biblioteca_norm(tg.name) in (select public.biblioteca_norm(t) from unnest(new_tags) t)
  on conflict (video_id, tag_id) do nothing;
  return null;
end;
$$;

create trigger biblioteca_videos_hashtags
  after insert or update of description, instagram_caption, instagram_caption_original on public.biblioteca_videos
  for each row execute function public.biblioteca_videos_hashtags();

-- Vídeos já cadastrados: aplica as hashtags que já estão nos textos
insert into public.biblioteca_tags (user_id, name, color)
select distinct on (v.user_id, public.biblioteca_norm(t)) v.user_id, t, '#6366f1'
  from public.biblioteca_videos v,
       unnest(public.biblioteca_hashtags(concat_ws(' ', v.description, v.instagram_caption, v.instagram_caption_original))) t
on conflict (user_id, public.biblioteca_norm(name)) do nothing;

insert into public.biblioteca_video_tags (video_id, tag_id)
select v.id, tg.id
  from public.biblioteca_videos v
  cross join lateral unnest(public.biblioteca_hashtags(concat_ws(' ', v.description, v.instagram_caption, v.instagram_caption_original))) t
  join public.biblioteca_tags tg on tg.user_id = v.user_id and public.biblioteca_norm(tg.name) = public.biblioteca_norm(t)
on conflict (video_id, tag_id) do nothing;
