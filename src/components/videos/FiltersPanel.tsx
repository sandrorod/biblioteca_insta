import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorBadge } from '@/components/ui/misc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCategories, useTags } from '@/hooks/useTaxonomy';
import type { VideoFilters } from '@/types';
import { cn } from '@/utils/cn';
import { activeFilterCount } from '@/utils/filters';
import { formatDate } from '@/utils/format';

interface Props {
  filters: VideoFilters;
  onChange: (f: VideoFilters) => void;
  /** Filtros fixos da página (ex.: favoritos) — não aparecem como opção */
  locked?: (keyof VideoFilters)[];
}

const selectCls =
  'h-9 w-full rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20';

/** Painel de filtros combináveis (aplicados no banco). */
export function FiltersPanel({ filters, onChange, locked = [] }: Props) {
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const [tagSearch, setTagSearch] = useState('');
  const count = activeFilterCount(filters);
  const set = (patch: Partial<VideoFilters>) => onChange({ ...filters, ...patch });
  const selectedTags = new Set(filters.tag_ids ?? []);
  const visibleTags = tags.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()));

  const categoryValue = filters.uncategorized ? '__none' : (filters.category_id ?? '');
  const comments = filters.has_comments === true ? 'with' : filters.has_comments === false ? 'without' : '';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 shrink-0">
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filtros</span>
          {count > 0 && <span className="rounded-full bg-zinc-900 px-1.5 text-[11px] font-semibold text-white">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[min(70vh,560px)] w-[340px] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
          <span className="text-sm font-semibold">Filtros</span>
          {count > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              onClick={() => onChange({ search: filters.search })}
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div className="space-y-5 p-4">
          {!locked.includes('category_id') && (
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <select
                className={selectCls}
                value={categoryValue}
                onChange={(e) => {
                  const v = e.target.value;
                  set({ category_id: v && v !== '__none' ? v : undefined, uncategorized: v === '__none' || undefined });
                }}
              >
                <option value="">Todas</option>
                <option value="__none">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!locked.includes('tag_ids') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Etiquetas</Label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <input type="checkbox" checked={!!filters.untagged} onChange={(e) => set({ untagged: e.target.checked || undefined, tag_ids: e.target.checked ? undefined : filters.tag_ids })} />
                  Sem etiquetas
                </label>
              </div>
              {!filters.untagged && (
                <>
                  {tags.length > 8 && <Input value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Buscar etiqueta…" className="h-8" />}
                  <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                    {visibleTags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma etiqueta.</p>}
                    {visibleTags.map((t) => {
                      const on = selectedTags.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(selectedTags);
                            if (on) next.delete(t.id);
                            else next.add(t.id);
                            set({ tag_ids: [...next] });
                          }}
                          className={cn('rounded-full transition', on ? 'ring-2 ring-zinc-900 ring-offset-1' : 'opacity-80 hover:opacity-100')}
                        >
                          <ColorBadge name={t.name} color={t.color} />
                        </button>
                      );
                    })}
                  </div>
                  {selectedTags.size > 1 && <p className="text-xs text-muted-foreground">Mostra vídeos com todas as etiquetas selecionadas.</p>}
                </>
              )}
            </div>
          )}

          {!locked.includes('favorites') && (
            <label className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-700">Somente favoritos</span>
              <input type="checkbox" checked={!!filters.favorites} onChange={(e) => set({ favorites: e.target.checked || undefined })} />
            </label>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="f-profile">Perfil de origem</Label>
            <Input id="f-profile" value={filters.profile ?? ''} onChange={(e) => set({ profile: e.target.value || undefined })} placeholder="ex.: nomedoperfil" />
          </div>

          <div className="space-y-1.5">
            <Label>Comentários</Label>
            <select className={selectCls} value={comments} onChange={(e) => set({ has_comments: e.target.value === 'with' ? true : e.target.value === 'without' ? false : undefined })}>
              <option value="">Todos</option>
              <option value="with">Com comentários</option>
              <option value="without">Sem comentários</option>
            </select>
          </div>

          <DateRange label="Data de cadastro" from={filters.created_from} to={filters.created_to} onChange={(from, to) => set({ created_from: from, created_to: to })} />
          <DateRange label="Data de publicação" from={filters.published_from} to={filters.published_to} onChange={(from, to) => set({ published_from: from, published_to: to })} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DateRange({ label, from, to, onChange }: { label: string; from?: string; to?: string; onChange: (from?: string, to?: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={from ?? ''} max={to} onChange={(e) => onChange(e.target.value || undefined, to)} aria-label={`${label}: de`} />
        <Input type="date" value={to ?? ''} min={from} onChange={(e) => onChange(from, e.target.value || undefined)} aria-label={`${label}: até`} />
      </div>
    </div>
  );
}

/** Filtros ativos como "chips" removíveis. */
export function ActiveFilters({ filters, onChange, locked = [] }: Props) {
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const chips: { key: string; label: string; remove: Partial<VideoFilters> }[] = [];

  if (filters.category_id && !locked.includes('category_id'))
    chips.push({ key: 'cat', label: `Categoria: ${categories.find((c) => c.id === filters.category_id)?.name ?? '…'}`, remove: { category_id: undefined } });
  if (filters.uncategorized) chips.push({ key: 'nocat', label: 'Sem categoria', remove: { uncategorized: undefined } });
  for (const id of filters.tag_ids ?? [])
    chips.push({ key: `t${id}`, label: `#${tags.find((t) => t.id === id)?.name ?? '…'}`, remove: { tag_ids: filters.tag_ids!.filter((x) => x !== id) } });
  if (filters.untagged) chips.push({ key: 'notag', label: 'Sem etiquetas', remove: { untagged: undefined } });
  if (filters.favorites && !locked.includes('favorites')) chips.push({ key: 'fav', label: 'Favoritos', remove: { favorites: undefined } });
  if (filters.profile) chips.push({ key: 'prof', label: `@${filters.profile}`, remove: { profile: undefined } });
  if (filters.has_comments === true) chips.push({ key: 'cm', label: 'Com comentários', remove: { has_comments: undefined } });
  if (filters.has_comments === false) chips.push({ key: 'ncm', label: 'Sem comentários', remove: { has_comments: undefined } });
  if (filters.created_from || filters.created_to)
    chips.push({ key: 'cr', label: `Cadastro: ${rangeLabel(filters.created_from, filters.created_to)}`, remove: { created_from: undefined, created_to: undefined } });
  if (filters.published_from || filters.published_to)
    chips.push({ key: 'pb', label: `Publicação: ${rangeLabel(filters.published_from, filters.published_to)}`, remove: { published_from: undefined, published_to: undefined } });

  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-full border bg-white py-0.5 pl-2.5 pr-1 text-xs font-medium text-zinc-700 shadow-sm">
          {c.label}
          <button type="button" onClick={() => onChange({ ...filters, ...c.remove })} className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800" aria-label={`Remover filtro ${c.label}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => onChange({ search: filters.search })} className="px-1 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline">
        Limpar todos
      </button>
    </div>
  );
}

function rangeLabel(from?: string, to?: string) {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  return from ? `desde ${formatDate(from)}` : `até ${formatDate(to)}`;
}
