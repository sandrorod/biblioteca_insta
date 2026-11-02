-- Desempenho com 20 mil vídeos (tudo desfeito no final). Mostra o tempo das consultas principais.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'biblioteca-perf@example.com', '{}', now(), now());
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000aa","role":"authenticated"}', true);
set local role authenticated;

insert into public.biblioteca_tags (id, name) select gen_random_uuid(), 'tag' || g from generate_series(1, 50) g;
insert into public.biblioteca_videos (title, instagram_url, description, profile_name, created_at)
select 'Vídeo de referência ' || g || case when g % 97 = 0 then ' transição mágica' else '' end,
       'https://www.instagram.com/p/PERF' || g || '/',
       'Descrição longa do vídeo número ' || g || ' com ideias de edição e roteiro',
       'perfil' || (g % 300),
       now() - (g || ' minutes')::interval
  from generate_series(1, 20000) g;
insert into public.biblioteca_video_tags (video_id, tag_id)
select v.id, t.id from (select id, row_number() over () rn from public.biblioteca_videos) v
  join (select id, row_number() over () rn from public.biblioteca_tags) t on t.rn = (v.rn % 50) + 1;
analyze public.biblioteca_videos;
analyze public.biblioteca_video_tags;

create temp table perf (consulta text, ms numeric, linhas int);
grant all on perf to authenticated;
do $$
declare t0 timestamptz; n int; last record;
begin
  t0 := clock_timestamp(); select count(*) into n from public.biblioteca_list_videos('{}', 'recent', null, 24);
  insert into perf values ('1ª página (recentes)', extract(milliseconds from clock_timestamp() - t0), n);

  select * into last from public.biblioteca_list_videos('{}', 'recent', null, 24) offset 23;
  for i in 1..400 loop
    select * into last from public.biblioteca_list_videos('{}', 'recent', jsonb_build_object('v', last.sort_key, 'id', last.id), 24) offset 23;
  end loop;
  t0 := clock_timestamp(); select count(*) into n from public.biblioteca_list_videos('{}', 'recent', jsonb_build_object('v', last.sort_key, 'id', last.id), 24);
  insert into perf values ('página 400+ (cursor)', extract(milliseconds from clock_timestamp() - t0), n);

  t0 := clock_timestamp(); select count(*) into n from public.biblioteca_list_videos('{}', 'title_asc', null, 24);
  insert into perf values ('1ª página (A–Z)', extract(milliseconds from clock_timestamp() - t0), n);

  t0 := clock_timestamp(); select count(*) into n from public.biblioteca_list_videos('{"search":"transicao magica"}', 'recent', null, 24);
  insert into perf values ('pesquisa "transicao magica"', extract(milliseconds from clock_timestamp() - t0), n);

  t0 := clock_timestamp(); n := public.biblioteca_count_videos('{"search":"transicao magica"}');
  insert into perf values ('contagem da pesquisa', extract(milliseconds from clock_timestamp() - t0), n);

  t0 := clock_timestamp(); n := public.biblioteca_count_videos('{}');
  insert into perf values ('contagem total', extract(milliseconds from clock_timestamp() - t0), n);

  t0 := clock_timestamp(); select count(*) into n from public.biblioteca_list_videos(jsonb_build_object('tag_ids', (select jsonb_agg(id) from (select id from public.biblioteca_tags limit 1) x), 'profile', 'perfil7'), 'recent', null, 24);
  insert into perf values ('etiqueta + perfil', extract(milliseconds from clock_timestamp() - t0), n);

  t0 := clock_timestamp(); perform public.biblioteca_dashboard();
  insert into perf values ('dashboard', extract(milliseconds from clock_timestamp() - t0), null);
end $$;
select consulta, round(ms, 1) as ms, linhas from perf;
rollback;
