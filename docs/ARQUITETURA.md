# Arquitetura

## Visão geral

O frontend é uma SPA em React que fala direto com o Supabase, com a chave pública e a sessão do usuário. Não existe servidor próprio:
- **Postgres + RLS** garante que cada usuário só lê e altera a própria biblioteca.
- **Funções SQL (RPC)** fazem a pesquisa, os filtros, a ordenação e a paginação, sempre no banco.
- **Storage** guarda as capas enviadas.
- **Edge Function** (opcional) busca a capa pela API oficial oEmbed da Meta.

```
React (TanStack Query) ──► supabase-js ──► PostgREST ──► Postgres (RLS)
                                    ├──► Storage (biblioteca_thumbnails)
                                    └──► Edge Function biblioteca_instagram_oembed ──► Meta oEmbed
```

## Banco de dados

Todos os objetos têm o prefixo `biblioteca_`, porque o projeto Supabase é compartilhado.

| Tabela | Conteúdo |
|---|---|
| `biblioteca_videos` | vídeo (link, título, descrição, capa, perfil, categoria, datas, observações, favorito, arquivado) |
| `biblioteca_categories` | categoria principal (cor, descrição, posição) |
| `biblioteca_tags` / `biblioteca_video_tags` | etiquetas e a ligação N:N com vídeos |
| `biblioteca_comments` | comentários por vídeo |
| `biblioteca_collections` / `biblioteca_collection_videos` | coleções e a ligação N:N |
| `biblioteca_profiles` | perfis de origem já usados (preenchido por gatilho, usado nas sugestões) |
| `biblioteca_schema_migrations` | controle das migrations aplicadas |

### Integridade

- **Duplicidade**: há um índice único em `(user_id, instagram_key)`. `instagram_key` é uma coluna gerada com o código curto da publicação, então `/p/X`, `/reel/X` e `?igsh=` contam como a mesma publicação.
- **Categoria de outro usuário**: a chave estrangeira composta `(category_id, user_id)` impede usar. Comentários usam `(video_id, user_id)` da mesma forma.
- **Tabelas de ligação**: as políticas de RLS exigem que o vídeo e a etiqueta (ou a coleção) sejam do próprio usuário.
- **Visitantes**: o papel `anon` não tem permissão em nenhuma tabela.

### Pesquisa

`search_text` é um texto normalizado (minúsculas, sem acentos) com título, descrição, link do Instagram, perfil, data de publicação, observações, nome da categoria, nomes das etiquetas, conteúdo dos comentários e nomes das coleções.

Os gatilhos o mantêm atualizado quando muda:
- o próprio vídeo;
- as etiquetas do vídeo;
- um comentário;
- a entrada ou saída de uma coleção;
- o nome de uma categoria, etiqueta ou coleção.

A pesquisa quebra o termo em palavras: todas precisam aparecer, em qualquer ordem, via `LIKE ALL`. Um índice GIN de trigramas (`pg_trgm`) acelera a busca, e os caracteres `%` e `_` são escapados.

### Listagem paginada por cursor

`biblioteca_list_videos(p_filters jsonb, p_sort text, p_cursor jsonb, p_limit int)`:
- Os filtros vêm em JSON (os mesmos campos do tipo `VideoFilters` do frontend). A condição SQL é compartilhada com `biblioteca_count_videos`, que dá a contagem total.
- Ordenações: `recent`, `oldest`, `title_asc`, `title_desc` e `updated`. Cada uma é `(chave, id)`, o que dá uma ordem estável mesmo com valores repetidos, e tem um índice composto `(user_id, is_archived, chave, id)`.
- Cada linha devolve `sort_key`, o valor da ordenação como texto. O cursor da próxima página é `{v: sort_key, id}` da última linha, e a consulta usa a comparação de linhas `(chave, id) < (cursor)`. Assim, ir para a página 400 custa o mesmo que ir para a página 1, ao contrário do `OFFSET`.
- A função é `security invoker`, então o RLS continua valendo, e o limite fica entre 1 e 100.

### Outras funções

- `biblioteca_dashboard()`: indicadores e rankings.
- `biblioteca_set_video_tags(video, tags[])`: define as etiquetas de um vídeo de forma atômica.
- `biblioteca_delete_category(id, transferir_para)`: exclui a categoria e transfere ou solta os vídeos.
- `biblioteca_reorder_categories(ids[])`: grava a nova ordem das categorias.
- Views `*_stats` (com `security_invoker`): listas com a contagem de vídeos.

## Frontend

- **Estado do servidor**: TanStack Query. `useInfiniteVideos` combina `useInfiniteQuery` (cursor) com a contagem; a chave do cache é `['videos', filtros, ordenação]`, então mudar um filtro recomeça do primeiro lote. As páginas são juntas sem duplicados.
- **Infinite scroll**:
  - `useIntersection` observa um elemento sentinela 800 px antes do fim.
  - Uma trava síncrona (`ref`) e o `cancelRefetch: false` impedem requisições simultâneas.
  - Em caso de erro, os vídeos já carregados continuam na tela e aparece o botão "Tentar novamente".
- **Filtros na URL**: `useGalleryParams` guarda pesquisa, filtros, ordenação e o vídeo aberto (`?video=`), para que os links possam ser compartilhados e o botão voltar funcione. As páginas Favoritos, Arquivados e Coleção aplicam filtros fixos (`base`).
- **Modal**: navega pela lista já carregada, que respeita os filtros. No último item, pede o próximo lote. Os comentários são carregados só quando o vídeo é aberto.
- **Ações otimistas**: o favorito muda na tela na hora (`setQueriesData`) e volta atrás se o banco recusar.
- **Imagens**: `loading="lazy"` e `decoding="async"`. Capas enviadas são reduzidas no navegador (lado maior até 900 px, WebP).
- **Segurança no cliente**: o cache é limpo ao trocar de usuário, e só a chave anon é usada.

## Preparado para o futuro

- **Cadastro em lote e importação por planilha**: `createVideo` e a verificação de duplicidade por `instagram_key` podem ser reaproveitadas em lote. O índice único protege contra repetidos.
- **Etiquetas automáticas, resumo por IA e pesquisa semântica**:
  - Novas colunas ou tabelas `biblioteca_*` (por exemplo, embeddings com `pgvector`) podem ser preenchidas por Edge Functions.
  - A RPC de listagem aceita novos campos de filtro em `p_filters` sem mudar a assinatura.
- **Compartilhamento de coleções, equipes e múltiplos usuários**:
  - Todas as tabelas têm `user_id`, e o acesso está concentrado nas políticas de RLS.
  - Para equipes, basta criar `biblioteca_workspaces` e `biblioteca_workspace_members` e trocar as políticas para "membro do workspace".
- **Exportação**: as views `*_stats` e a RPC de listagem já entregam os dados prontos para CSV ou JSON.
