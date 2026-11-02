import { useQuery } from '@tanstack/react-query';
import { Folder, Hash, Search, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { useCategories, useTags } from '@/hooks/useTaxonomy';
import { searchProfiles } from '@/services/taxonomy';
import type { VideoFilters } from '@/types';
import { cn } from '@/utils/cn';

interface Props {
  value: string;
  onChange: (search: string) => void;
  /** Aplica uma sugestão como filtro (categoria, etiqueta ou perfil) */
  onApplyFilter: (patch: Partial<VideoFilters>) => void;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pesquisa instantânea (com debounce) e sugestões de categorias, etiquetas e perfis. */
export function SearchBar({ value, onChange, onApplyFilter }: Props) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const debounced = useDebounce(text, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const term = norm(debounced.trim());

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Atalho "/" foca a pesquisa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const profiles = useQuery({ queryKey: ['profiles', term], queryFn: () => searchProfiles(term, 4), enabled: focused && term.length >= 2 });

  const suggestions = term.length >= 2
    ? [
        ...categories.filter((c) => norm(c.name).includes(term)).slice(0, 3).map((c) => ({ key: `c${c.id}`, icon: Folder, label: c.name, hint: 'Categoria', apply: { category_id: c.id, uncategorized: undefined } })),
        ...tags.filter((t) => norm(t.name).includes(term)).slice(0, 4).map((t) => ({ key: `t${t.id}`, icon: Hash, label: t.name, hint: 'Etiqueta', apply: { tag_ids: [t.id], untagged: undefined } })),
        ...(profiles.data ?? []).map((p) => ({ key: `p${p}`, icon: User, label: `@${p}`, hint: 'Perfil', apply: { profile: p } })),
      ]
    : [];

  const clear = () => {
    setText('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => e.key === 'Escape' && (text ? clear() : inputRef.current?.blur())}
        placeholder="Pesquisar título, descrição, perfil, comentários, etiquetas…"
        className="h-10 pl-9 pr-9"
        aria-label="Pesquisar vídeos"
      />
      {text && (
        <button type="button" onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Limpar pesquisa">
          <X className="h-4 w-4" />
        </button>
      )}
      {focused && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border bg-white py-1 shadow-lg">
          <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Filtrar por</p>
          {suggestions.map((s) => (
            <button
              key={s.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onApplyFilter(s.apply);
                setText('');
                onChange('');
                inputRef.current?.blur();
              }}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50')}
            >
              <s.icon className="h-4 w-4 text-zinc-400" />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
