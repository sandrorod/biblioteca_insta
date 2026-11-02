-- ════════════════════════════════════════════════════════════════════════════
-- Instagram Video Library — esquema principal
-- Todas as tabelas, funções e o bucket deste projeto usam o prefixo "biblioteca_"
-- (o projeto Supabase é compartilhado com outros sistemas).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Texto normalizado para busca: minúsculas e sem acentos (imutável para poder ser indexado)
create or replace function public.biblioteca_norm(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;

-- Chave única de uma publicação do Instagram: o código curto (/p/, /reel/, /reels/, /tv/) ou a URL limpa
create or replace function public.biblioteca_instagram_key(url text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    substring(url from '(?i)instagram\.com/(?:[A-Za-z0-9_.]+/)?(?:p|reels?|tv)/([A-Za-z0-9_-]+)'),
    lower(regexp_replace(regexp_replace(trim(url), '[?#].*$', ''), '/+$', ''))
  )
$$;

-- ─── Categorias ───────────────────────────────────────────────────────────────
create table public.biblioteca_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  color text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index biblioteca_categories_user_name_key on public.biblioteca_categories (user_id, public.biblioteca_norm(name));
create index biblioteca_categories_user_position_idx on public.biblioteca_categories (user_id, position, created_at);

-- ─── Etiquetas ────────────────────────────────────────────────────────────────
create table public.biblioteca_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index biblioteca_tags_user_name_key on public.biblioteca_tags (user_id, public.biblioteca_norm(name));

-- ─── Perfis de origem (preenchido automaticamente a partir dos vídeos) ────────
create table public.biblioteca_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create unique index biblioteca_profiles_user_name_key on public.biblioteca_profiles (user_id, public.biblioteca_norm(name));

-- ─── Vídeos ───────────────────────────────────────────────────────────────────
create table public.biblioteca_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 300),
  instagram_url text not null check (instagram_url ~* '^https?://'),
  instagram_key text generated always as (public.biblioteca_instagram_key(instagram_url)) stored,
  description text check (char_length(description) <= 10000),
  thumbnail_url text,
  profile_name text check (char_length(profile_name) <= 100),
  category_id uuid,
  original_publish_date date,
  notes text check (char_length(notes) <= 20000),
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  comments_count integer not null default 0,
  -- Texto de busca: título, descrição, perfil, observações, categoria, etiquetas e comentários (mantido por gatilhos)
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A categoria precisa ser do mesmo usuário
  foreign key (category_id, user_id) references public.biblioteca_categories (id, user_id) on delete set null (category_id),
  unique (id, user_id)
);
create unique index biblioteca_videos_user_key on public.biblioteca_videos (user_id, instagram_key);
-- Ordenações estáveis (com id como desempate) para a paginação por cursor
create index biblioteca_videos_created_idx on public.biblioteca_videos (user_id, is_archived, created_at desc, id desc);
create index biblioteca_videos_updated_idx on public.biblioteca_videos (user_id, is_archived, updated_at desc, id desc);
create index biblioteca_videos_title_idx on public.biblioteca_videos (user_id, is_archived, lower(title), id);
create index biblioteca_videos_category_idx on public.biblioteca_videos (category_id);
create index biblioteca_videos_favorite_idx on public.biblioteca_videos (user_id, created_at desc) where is_favorite;
create index biblioteca_videos_publish_idx on public.biblioteca_videos (user_id, original_publish_date);
create index biblioteca_videos_profile_idx on public.biblioteca_videos (user_id, public.biblioteca_norm(profile_name));
create index biblioteca_videos_search_idx on public.biblioteca_videos using gin (search_text extensions.gin_trgm_ops);

-- ─── Etiquetas de cada vídeo ──────────────────────────────────────────────────
create table public.biblioteca_video_tags (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.biblioteca_videos (id) on delete cascade,
  tag_id uuid not null references public.biblioteca_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (video_id, tag_id)
);
create index biblioteca_video_tags_tag_idx on public.biblioteca_video_tags (tag_id, video_id);

-- ─── Comentários ──────────────────────────────────────────────────────────────
create table public.biblioteca_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  video_id uuid not null,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (video_id, user_id) references public.biblioteca_videos (id, user_id) on delete cascade
);
create index biblioteca_comments_video_idx on public.biblioteca_comments (video_id, created_at desc);

-- ─── Coleções ─────────────────────────────────────────────────────────────────
create table public.biblioteca_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text check (char_length(description) <= 1000),
  color text not null default '#ec4899' check (color ~ '^#[0-9a-fA-F]{6}$'),
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index biblioteca_collections_user_idx on public.biblioteca_collections (user_id, updated_at desc);

create table public.biblioteca_collection_videos (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.biblioteca_collections (id) on delete cascade,
  video_id uuid not null references public.biblioteca_videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (collection_id, video_id)
);
create index biblioteca_collection_videos_video_idx on public.biblioteca_collection_videos (video_id);
create index biblioteca_collection_videos_collection_idx on public.biblioteca_collection_videos (collection_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- Segurança (RLS): cada usuário só enxerga e altera a própria biblioteca
-- ════════════════════════════════════════════════════════════════════════════
alter table public.biblioteca_categories enable row level security;
alter table public.biblioteca_tags enable row level security;
alter table public.biblioteca_profiles enable row level security;
alter table public.biblioteca_videos enable row level security;
alter table public.biblioteca_video_tags enable row level security;
alter table public.biblioteca_comments enable row level security;
alter table public.biblioteca_collections enable row level security;
alter table public.biblioteca_collection_videos enable row level security;

create policy biblioteca_categories_owner on public.biblioteca_categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy biblioteca_tags_owner on public.biblioteca_tags for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy biblioteca_profiles_owner on public.biblioteca_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy biblioteca_videos_owner on public.biblioteca_videos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy biblioteca_comments_owner on public.biblioteca_comments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy biblioteca_collections_owner on public.biblioteca_collections for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Tabelas de ligação: o vídeo e a etiqueta/coleção precisam ser do próprio usuário
create policy biblioteca_video_tags_owner on public.biblioteca_video_tags for all to authenticated
  using (exists (select 1 from public.biblioteca_videos v where v.id = video_id and v.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.biblioteca_videos v where v.id = video_id and v.user_id = (select auth.uid()))
    and exists (select 1 from public.biblioteca_tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );
create policy biblioteca_collection_videos_owner on public.biblioteca_collection_videos for all to authenticated
  using (exists (select 1 from public.biblioteca_collections c where c.id = collection_id and c.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.biblioteca_collections c where c.id = collection_id and c.user_id = (select auth.uid()))
    and exists (select 1 from public.biblioteca_videos v where v.id = video_id and v.user_id = (select auth.uid()))
  );

-- Visitantes sem login não têm acesso algum
revoke all on public.biblioteca_categories, public.biblioteca_tags, public.biblioteca_profiles, public.biblioteca_videos,
  public.biblioteca_video_tags, public.biblioteca_comments, public.biblioteca_collections, public.biblioteca_collection_videos
  from anon;
