import type { SortOption, VideoFilters } from '@/types';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'title_asc', label: 'Ordem alfabética (A–Z)' },
  { value: 'title_desc', label: 'Título (Z–A)' },
  { value: 'updated', label: 'Última atualização' },
];

const SORTS = new Set<SortOption>(SORT_OPTIONS.map((o) => o.value));
const BOOL_KEYS = ['uncategorized', 'untagged', 'favorites'] as const;
const TEXT_KEYS = ['category_id', 'profile', 'created_from', 'created_to', 'published_from', 'published_to'] as const;

/** Filtros e ordenação guardados na URL (links compartilháveis e botão voltar funcionando). */
export function filtersFromParams(params: URLSearchParams): { filters: VideoFilters; sort: SortOption } {
  const f: VideoFilters = {};
  const q = params.get('q');
  if (q) f.search = q;
  for (const k of TEXT_KEYS) {
    const v = params.get(k);
    if (v) f[k] = v;
  }
  for (const k of BOOL_KEYS) if (params.get(k) === '1') f[k] = true;
  const tags = params.get('tags');
  if (tags) f.tag_ids = tags.split(',').filter(Boolean);
  const comments = params.get('comments');
  if (comments === 'with') f.has_comments = true;
  if (comments === 'without') f.has_comments = false;
  const sort = params.get('sort') as SortOption | null;
  return { filters: f, sort: sort && SORTS.has(sort) ? sort : 'recent' };
}

export function paramsFromFilters(filters: VideoFilters, sort: SortOption): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.search?.trim()) p.set('q', filters.search);
  for (const k of TEXT_KEYS) if (filters[k]) p.set(k, filters[k]!);
  for (const k of BOOL_KEYS) if (filters[k]) p.set(k, '1');
  if (filters.tag_ids?.length) p.set('tags', filters.tag_ids.join(','));
  if (filters.has_comments === true) p.set('comments', 'with');
  if (filters.has_comments === false) p.set('comments', 'without');
  if (sort !== 'recent') p.set('sort', sort);
  return p;
}

/** Remove campos vazios antes de enviar ao banco (e para a chave do cache ficar estável). */
export function cleanFilters(filters: VideoFilters): VideoFilters {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '' || v === false && k !== 'has_comments' && k !== 'archived') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
    if (out[k] === '') delete out[k];
  }
  return out as VideoFilters;
}

/** Quantos filtros (além da pesquisa) estão ativos. */
export function activeFilterCount(filters: VideoFilters): number {
  let n = 0;
  if (filters.category_id || filters.uncategorized) n++;
  if (filters.tag_ids?.length || filters.untagged) n++;
  if (filters.favorites) n++;
  if (filters.profile) n++;
  if (filters.has_comments !== undefined) n++;
  if (filters.created_from || filters.created_to) n++;
  if (filters.published_from || filters.published_to) n++;
  return n;
}
