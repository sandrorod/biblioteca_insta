-- ════════════════════════════════════════════════════════════════════════════
-- Testes do banco (RLS, busca, filtros, paginação por cursor, gatilhos).
-- Tudo roda numa transação desfeita no final: nada fica gravado.
-- Executar: `npm run test:db` (usa DATABASE_URL do .env).
-- ════════════════════════════════════════════════════════════════════════════
begin;

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALHOU: %', msg; end if;
end $$;

-- Usuários de teste (o gatilho de cadastro do projeto roda, mas tudo é desfeito no final)
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'biblioteca-teste-a@example.com', '{}', now(), now()),
       ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'biblioteca-teste-b@example.com', '{}', now(), now());

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- ─── Usuário A monta a biblioteca ────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-4000-8000-00000000000a');

insert into public.biblioteca_categories (id, name, color) values
  ('10000000-0000-4000-8000-000000000001', 'Edição', '#ff0000'),
  ('10000000-0000-4000-8000-000000000002', 'Campanhas', '#00ff00');
insert into public.biblioteca_tags (id, name) values
  ('20000000-0000-4000-8000-000000000001', 'transição'),
  ('20000000-0000-4000-8000-000000000002', 'humor');

insert into public.biblioteca_videos (id, title, instagram_url, profile_name, category_id, description)
values ('30000000-0000-4000-8000-000000000001', 'Corte rápido', 'https://www.instagram.com/reel/ABC123xyz/?igsh=1', '@editor.pro',
        '10000000-0000-4000-8000-000000000001', 'Cortes no ritmo da música');

-- 30 vídeos extras para a paginação
insert into public.biblioteca_videos (title, instagram_url, created_at)
select 'Vídeo ' || lpad(g::text, 2, '0'), 'https://www.instagram.com/p/POST' || g || '/', now() - (g || ' minutes')::interval
  from generate_series(1, 30) g;

-- Duplicidade: mesma publicação por /p/ em vez de /reel/
do $$ begin
  insert into public.biblioteca_videos (instagram_url) values ('https://instagram.com/p/ABC123xyz');
  raise exception 'FALHOU: URL duplicada foi aceita';
exception when unique_violation then null;
end $$;

select pg_temp.ok((select profile_name from public.biblioteca_videos where id = '30000000-0000-4000-8000-000000000001') = 'editor.pro',
  'perfil sem @');
select pg_temp.ok(exists (select 1 from public.biblioteca_profiles where name = 'editor.pro'), 'perfil de origem registrado');

-- Etiquetas e comentários entram na busca
select public.biblioteca_set_video_tags('30000000-0000-4000-8000-000000000001',
  array['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002']::uuid[]);
insert into public.biblioteca_comments (video_id, content) values ('30000000-0000-4000-8000-000000000001', 'Reproduzir esse formato na campanha de Natal');

select pg_temp.ok((select comments_count from public.biblioteca_videos where id = '30000000-0000-4000-8000-000000000001') = 1, 'contagem de comentários');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "natal"}') = 1, 'busca por comentário');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "TRANSICAO"}') = 1, 'busca por etiqueta sem acento');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "edicao corte"}') = 1, 'busca por categoria + título (várias palavras)');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "editor.pro"}') = 1, 'busca por perfil');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "100%"}') = 0, 'caractere especial não vira curinga');
select pg_temp.ok(public.biblioteca_count_videos('{}') = 31, 'total sem filtros');

-- Renomear etiqueta reindexa
update public.biblioteca_tags set name = 'comédia' where id = '20000000-0000-4000-8000-000000000002';
select pg_temp.ok(public.biblioteca_count_videos('{"search": "comedia"}') = 1, 'etiqueta renomeada pesquisável');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "humor"}') = 0, 'nome antigo da etiqueta some da busca');

-- Filtros
select pg_temp.ok(public.biblioteca_count_videos('{"tag_ids": ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002"]}') = 1, 'todas as etiquetas');
select pg_temp.ok(public.biblioteca_count_videos('{"untagged": true}') = 30, 'sem etiquetas');
select pg_temp.ok(public.biblioteca_count_videos('{"has_comments": true}') = 1, 'com comentários');
select pg_temp.ok(public.biblioteca_count_videos('{"has_comments": false}') = 30, 'sem comentários');
select pg_temp.ok(public.biblioteca_count_videos('{"uncategorized": true}') = 30, 'sem categoria');
select pg_temp.ok(public.biblioteca_count_videos('{"category_id": "10000000-0000-4000-8000-000000000001"}') = 1, 'por categoria');
select pg_temp.ok(public.biblioteca_count_videos('{"profile": "editor.pro"}') = 1, 'por perfil');

update public.biblioteca_videos set is_favorite = true where title in ('Vídeo 01', 'Vídeo 02');
update public.biblioteca_videos set is_archived = true where title = 'Vídeo 03';
select pg_temp.ok(public.biblioteca_count_videos('{"favorites": true}') = 2, 'favoritos');
select pg_temp.ok(public.biblioteca_count_videos('{"archived": true}') = 1, 'arquivados');
select pg_temp.ok(public.biblioteca_count_videos('{}') = 30, 'arquivado sai da galeria');

-- Paginação por cursor: 24 + 6, sem repetição, na ordem certa (todas as ordenações)
do $$
declare
  s text;
  last_row record;
  ids uuid[];
  page2 uuid[];
begin
  foreach s in array array['recent', 'oldest', 'title_asc', 'title_desc', 'updated'] loop
    select array_agg(id) into ids from public.biblioteca_list_videos('{}', s, null, 24);
    perform pg_temp.ok(array_length(ids, 1) = 24, s || ': primeira página com 24');
    select * into last_row from public.biblioteca_list_videos('{}', s, null, 24) offset 23 limit 1;
    select array_agg(id) into page2 from public.biblioteca_list_videos('{}', s, jsonb_build_object('v', last_row.sort_key, 'id', last_row.id), 24);
    perform pg_temp.ok(array_length(page2, 1) = 6, s || ': segunda página com 6');
    perform pg_temp.ok(not (ids && page2), s || ': sem repetição entre páginas');
  end loop;
end $$;

select pg_temp.ok((select title from public.biblioteca_list_videos('{}', 'title_asc', null, 1)) = 'Corte rápido', 'ordem alfabética');
select pg_temp.ok((select title from public.biblioteca_list_videos('{}', 'recent', null, 2) offset 1) = 'Vídeo 01', 'mais recentes primeiro');

-- Excluir categoria transferindo vídeos
select public.biblioteca_delete_category('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
select pg_temp.ok((select category_id from public.biblioteca_videos where id = '30000000-0000-4000-8000-000000000001') = '10000000-0000-4000-8000-000000000002', 'vídeos transferidos');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "campanhas"}') = 1, 'busca usa a nova categoria');

-- Coleções
insert into public.biblioteca_collections (id, name) values ('40000000-0000-4000-8000-000000000001', 'Inspirações');
insert into public.biblioteca_collection_videos (collection_id, video_id) values ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');

-- Dados do Instagram (legenda e autor) entram na pesquisa
update public.biblioteca_videos set instagram_caption = 'Abertura de xadrez com ChatGPT', instagram_author_name = 'Leo Messi', instagram_like_count = 10
 where id = '30000000-0000-4000-8000-000000000001';
select pg_temp.ok(public.biblioteca_count_videos('{"search": "xadrez chatgpt"}') = 1, 'busca pela legenda do Instagram');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "leo messi"}') = 1, 'busca pelo autor no Instagram');
select pg_temp.ok((select instagram_like_count from public.biblioteca_list_videos('{"search": "xadrez"}', 'recent', null, 1)) = 10, 'listagem devolve dados do Instagram');
update public.biblioteca_videos set instagram_caption = 'Abertura de xadrez traduzida', instagram_caption_original = 'Apertura de ajedrez original', instagram_caption_lang = 'es'
 where id = '30000000-0000-4000-8000-000000000001';
select pg_temp.ok(public.biblioteca_count_videos('{"search": "ajedrez"}') = 1, 'busca pela legenda original (não traduzida)');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "traduzida"}') = 1, 'busca pela legenda traduzida');
select pg_temp.ok((select instagram_caption_lang from public.biblioteca_list_videos('{"search": "ajedrez"}', 'recent', null, 1)) = 'es', 'listagem devolve o idioma da legenda');

-- #hashtags da descrição e da legenda viram etiquetas (reaproveita as existentes; só as novas no texto)
select pg_temp.ok(public.biblioteca_hashtags('Veja #Edição, #edicao e #ChatGPT_Partner! #123 email@x.com') = array['Edição', 'ChatGPT_Partner'], 'extrai hashtags sem repetir grafias');
insert into public.biblioteca_videos (id, instagram_url, description)
values ('30000000-0000-4000-8000-0000000000c1', 'https://www.instagram.com/p/HASH1/', 'Ideia boa #Roteiro #transicao');
select pg_temp.ok((select array_agg(t.name order by t.name) from public.biblioteca_video_tags vt join public.biblioteca_tags t on t.id = vt.tag_id
                    where vt.video_id = '30000000-0000-4000-8000-0000000000c1') = array['Roteiro', 'transição'], 'hashtag vira etiqueta (e usa a existente "transição")');
select pg_temp.ok((select count(*) from public.biblioteca_tags where public.biblioteca_norm(name) = 'transicao') = 1, 'não duplica etiqueta existente');
-- Usuário remove a etiqueta; editar outra coisa (ou a descrição sem hashtag nova) não a traz de volta
delete from public.biblioteca_video_tags where video_id = '30000000-0000-4000-8000-0000000000c1'
   and tag_id = (select id from public.biblioteca_tags where name = 'Roteiro');
update public.biblioteca_videos set description = 'Ideia boa #Roteiro #transicao (editada)' where id = '30000000-0000-4000-8000-0000000000c1';
select pg_temp.ok(not exists (select 1 from public.biblioteca_video_tags vt join public.biblioteca_tags t on t.id = vt.tag_id
                   where vt.video_id = '30000000-0000-4000-8000-0000000000c1' and t.name = 'Roteiro'), 'etiqueta removida não volta');
update public.biblioteca_videos set instagram_caption = 'Legenda #Viral' where id = '30000000-0000-4000-8000-0000000000c1';
select pg_temp.ok(exists (select 1 from public.biblioteca_video_tags vt join public.biblioteca_tags t on t.id = vt.tag_id
                   where vt.video_id = '30000000-0000-4000-8000-0000000000c1' and t.name = 'Viral'), 'hashtag nova da legenda do Instagram vira etiqueta');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "viral"}') >= 1, 'etiqueta da hashtag entra na pesquisa');
delete from public.biblioteca_videos where id = '30000000-0000-4000-8000-0000000000c1';
select pg_temp.ok(public.biblioteca_count_videos('{"collection_id": "40000000-0000-4000-8000-000000000001"}') = 1, 'filtro por coleção');
select pg_temp.ok((select video_count from public.biblioteca_collections_stats) = 1, 'contagem da coleção');

-- Pesquisa em todos os campos: link, data de publicação e coleção
update public.biblioteca_videos set original_publish_date = '2024-03-15' where id = '30000000-0000-4000-8000-000000000001';
select pg_temp.ok(public.biblioteca_count_videos('{"search": "ABC123xyz"}') = 1, 'busca pelo código do link');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "instagram.com/reel"}') = 1, 'busca pelo link');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "15/03/2024"}') = 1, 'busca pela data de publicação (DD/MM/AAAA)');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "2024-03-15"}') = 1, 'busca pela data de publicação (AAAA-MM-DD)');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "inspiracoes"}') = 1, 'busca pelo nome da coleção');
update public.biblioteca_collections set name = 'Referências' where id = '40000000-0000-4000-8000-000000000001';
select pg_temp.ok(public.biblioteca_count_videos('{"search": "referencias corte"}') = 1, 'coleção renomeada pesquisável');
select pg_temp.ok(public.biblioteca_count_videos('{"search": "inspiracoes"}') = 0, 'nome antigo da coleção some da busca');
delete from public.biblioteca_collection_videos where collection_id = '40000000-0000-4000-8000-000000000001';
select pg_temp.ok(public.biblioteca_count_videos('{"search": "referencias"}') = 0, 'vídeo fora da coleção sai da busca por ela');
insert into public.biblioteca_collection_videos (collection_id, video_id) values ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');

select pg_temp.ok((public.biblioteca_dashboard()->>'videos')::int = 30, 'painel: vídeos');
select pg_temp.ok((public.biblioteca_dashboard()->>'favorites')::int = 2, 'painel: favoritos');

-- ─── Usuário B não enxerga nem altera nada de A ──────────────────────────────
reset role;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000b');

select pg_temp.ok((select count(*) from public.biblioteca_videos) = 0, 'RLS: vídeos de outro usuário invisíveis');
select pg_temp.ok((select count(*) from public.biblioteca_tags) = 0, 'RLS: etiquetas invisíveis');
select pg_temp.ok((select count(*) from public.biblioteca_comments) = 0, 'RLS: comentários invisíveis');
select pg_temp.ok((select count(*) from public.biblioteca_collection_videos) = 0, 'RLS: coleções invisíveis');
select pg_temp.ok(public.biblioteca_count_videos('{}') = 0, 'RLS: contagem só da própria biblioteca');
select pg_temp.ok((public.biblioteca_dashboard()->>'videos')::int = 0, 'RLS: painel só da própria biblioteca');

update public.biblioteca_videos set title = 'invadido' where id = '30000000-0000-4000-8000-000000000001';
delete from public.biblioteca_videos where id = '30000000-0000-4000-8000-000000000001';

-- Mesma URL que A já tem: B pode cadastrar (biblioteca própria)
insert into public.biblioteca_videos (id, instagram_url) values ('30000000-0000-4000-8000-0000000000b1', 'https://www.instagram.com/reel/ABC123xyz/');

do $$ begin
  insert into public.biblioteca_video_tags (video_id, tag_id) values ('30000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-000000000001');
  raise exception 'FALHOU: ligou etiqueta de outro usuário';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into public.biblioteca_videos (instagram_url, category_id) values ('https://www.instagram.com/p/XYZ/', '10000000-0000-4000-8000-000000000002');
  raise exception 'FALHOU: usou categoria de outro usuário';
exception when foreign_key_violation then null;
end $$;

do $$ begin
  insert into public.biblioteca_comments (video_id, content) values ('30000000-0000-4000-8000-000000000001', 'oi');
  raise exception 'FALHOU: comentou no vídeo de outro usuário';
exception when foreign_key_violation or insufficient_privilege then null;
end $$;

do $$ begin
  insert into public.biblioteca_videos (user_id, instagram_url) values ('00000000-0000-4000-8000-00000000000a', 'https://www.instagram.com/p/FORJADO/');
  raise exception 'FALHOU: gravou vídeo em nome de outro usuário';
exception when insufficient_privilege then null;
end $$;

reset role;
select pg_temp.ok((select title from public.biblioteca_videos where id = '30000000-0000-4000-8000-000000000001') = 'Corte rápido', 'RLS: B não alterou nem apagou o vídeo de A');

-- ─── Visitante sem login ─────────────────────────────────────────────────────
set local role anon;
do $$ begin
  perform count(*) from public.biblioteca_videos;
  raise exception 'FALHOU: visitante leu vídeos';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'TODOS OS TESTES PASSARAM' as resultado;
rollback;
