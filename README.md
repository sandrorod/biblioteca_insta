# Instagram Video Library

Biblioteca particular para **indexar, organizar e pesquisar vídeos do Instagram**: cadastro por link, categorias, etiquetas, comentários, observações internas, coleções, favoritos e arquivamento, numa galeria em grade no estilo do Instagram com carregamento progressivo (infinite scroll).

Cada usuário tem a sua biblioteca, protegida por RLS no banco. O app foi feito para dezenas de milhares de vídeos: a pesquisa, os filtros e a ordenação rodam no banco, e a galeria carrega 24 vídeos por vez com paginação por cursor.

## Funcionalidades

- **Dashboard**: totais (vídeos, categorias, etiquetas, favoritos, coleções), vídeos recentes, categorias e etiquetas mais usadas.
- **Galeria**: grade 4:5 (3 colunas no desktop, com opção de 4 ou 5), ícone de vídeo, favorito com um toque, detalhes ao passar o mouse.
- **Infinite scroll**: 24 por vez, Intersection Observer, cursor (`sort_key` + `id`), sem duplicados, uma requisição por vez, indicador de carregamento, erro com "Tentar novamente".
- **Pesquisa** em toda a biblioteca, sem diferenciar acentos: título, descrição, perfil, observações, comentários, categoria e etiquetas. Tem debounce, sugestões, contagem de resultados e atalho `/`.
- **Filtros combináveis**: categoria, sem categoria, uma ou várias etiquetas (todas), sem etiquetas, favoritos, perfil, com ou sem comentários, data de cadastro e data de publicação. Ficam na URL, então os links podem ser compartilhados.
- **Ordenação**: mais recentes, mais antigos, A–Z, Z–A, última atualização.
- **Modal**: player oficial do Instagram ou capa; dados completos; navegação anterior/próximo (também pelas setas ←/→) respeitando os filtros; comentários; coleções.
- **Cadastro rápido**: só o link. **Cadastro completo**: todos os campos, com etiquetas criadas na hora.
  - Duplicidade verificada enquanto o link é digitado, e garantida também no banco (o mesmo vídeo via `/p/` e via `/reel/` conta como duplicado).
- **Capa**: upload (reduzido para WebP), URL de imagem ou busca automática pela API oficial oEmbed da Meta (opcional, veja abaixo). Sem capa, é usada uma imagem padrão.
- **Categorias**: cor, descrição, reordenação e contagem. Ao excluir, os vídeos podem ser transferidos para outra categoria.
- **Etiquetas**: cor, pesquisa e contagem. **Coleções**: um vídeo pode estar em várias.
- **Favoritos** e **Arquivados** com página própria. Exclusão definitiva sempre com confirmação.
- **Autenticação**: login, cadastro, recuperação de senha, troca de senha, logout e páginas protegidas.

## Tecnologias

React 18, TypeScript, Vite, Tailwind CSS, componentes no padrão shadcn/ui (Radix UI), Lucide React, TanStack Query, React Router e Supabase (Postgres, Auth, Storage, Edge Functions). Testes com Vitest e Testing Library, mais testes SQL no próprio banco.

## Requisitos

- Node.js 20 ou superior (testado com 22) e npm.
- Um projeto Supabase.

## Instalação

```bash
git clone https://github.com/sandrorod/biblioteca_insta.git
cd biblioteca_insta
npm install
cp .env.example .env   # preencha os valores
```

### Variáveis de ambiente

| Variável | Onde é usada | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | navegador | URL do projeto (Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | navegador | chave pública **anon** (os dados são protegidos pelo RLS) |
| `DATABASE_URL` | só scripts locais | conexão Postgres usada por `npm run db:migrate` e `npm run test:db` |

Nunca use a chave `service_role` no frontend. O `.env` está no `.gitignore`.

## Configurar o Supabase

> **Projeto compartilhado:** tudo o que este app cria no banco tem o prefixo `biblioteca_`: tabelas, views, funções, o bucket `biblioteca_thumbnails`, a Edge Function `biblioteca_instagram_oembed` e o controle de migrations `biblioteca_schema_migrations`. Assim ele pode morar num projeto Supabase usado por outros sistemas sem conflito.

1. **Migrations**: com `DATABASE_URL` no `.env`, rode:
   ```bash
   npm run db:migrate
   ```
   O script aplica, em ordem e cada uma numa transação, os arquivos de `supabase/migrations/` que ainda não rodaram. Eles criam:
   - as extensões `pg_trgm` e `unaccent`;
   - as tabelas, índices, RLS, gatilhos e funções;
   - o bucket de capas com as políticas de acesso.

   Sem acesso direto ao Postgres, também dá para colar os arquivos em ordem no **SQL Editor** do Supabase.
2. **Auth → URL Configuration**: adicione a URL onde o app vai rodar em *Redirect URLs*, por exemplo `http://localhost:5173/**` e o domínio de produção. Sem isso, os links de recuperação de senha não voltam para o app.
3. **Capa automática (opcional)**:
   - Publique a função:
     ```bash
     npx supabase functions deploy biblioteca_instagram_oembed --remote=<ref-do-projeto> --use-api
     ```
   - Cadastre o segredo `META_OEMBED_TOKEN` (`APP_ID|CLIENT_TOKEN` de um app da Meta com o produto *oEmbed Read*):
     ```bash
     npx supabase secrets set META_OEMBED_TOKEN=... --remote=<ref-do-projeto>
     ```
   - Sem o token, o botão "Automática" avisa que não está configurado e o cadastro segue com upload ou URL de imagem.

## Rodar localmente

```bash
npm run dev        # http://localhost:5173
```

## Testes

```bash
npm test           # unitários e de componente (galeria, infinite scroll, filtros, links)
npm run test:db    # testes SQL no banco: RLS, busca, filtros, cursor e gatilhos (tudo desfeito ao final)
npm run test:db -- perf   # inclui o teste de desempenho com 20 mil vídeos
npm run typecheck
```

Os testes SQL criam usuários e dados dentro de uma transação que é desfeita ao final, então nada fica gravado.

## Build e publicação

```bash
npm run build      # gera dist/ (site estático)
npm run preview    # serve o build localmente
```

O `dist/` pode ser hospedado em qualquer serviço de site estático (Vercel, Netlify, Cloudflare Pages…). Configure as duas variáveis `VITE_*` e o *rewrite* de todas as rotas para `index.html` (SPA).

Para publicar uma atualização:
1. Crie uma migration nova em `supabase/migrations/`, com o prefixo de data e hora maior que o último, se houver mudança no banco.
2. Rode `npm run db:migrate`.
3. Faça commit e push para `main`.

## Estrutura

```
src/
  components/ui/        componentes base (botão, diálogo, popover, confirmação…)
  components/layout/    menu lateral, layout, proteção de rotas
  components/videos/    galeria, card, modal, filtros, pesquisa, editor, comentários
  pages/                Dashboard, vídeos, favoritos, arquivados, categorias, etiquetas, coleções, configurações, login…
  hooks/                infinite scroll, filtros na URL, ações dos vídeos, listas
  services/             acesso ao Supabase (vídeos, taxonomia, comentários, storage)
  integrations/supabase cliente do Supabase
  contexts/             sessão do usuário
  types/ utils/ styles/
supabase/
  migrations/           SQL versionado
  functions/            Edge Function da capa automática
  tests/                testes SQL (RLS, busca, cursor) e de desempenho
scripts/                migrate.mjs e db-test.mjs
docs/                   arquitetura
```

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) para os detalhes técnicos.
