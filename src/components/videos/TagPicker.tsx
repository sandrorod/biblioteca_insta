import { useQueryClient } from '@tanstack/react-query';
import { Hash, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { ColorBadge } from '@/components/ui/misc';
import { useTags } from '@/hooks/useTaxonomy';
import { friendlyError } from '@/services/errors';
import { createTag } from '@/services/taxonomy';
import type { Tag } from '@/types';
import { cn } from '@/utils/cn';
import { randomColor } from '@/utils/colors';
import { plural } from '@/utils/format';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Etiquetas do vídeo: conforme digita, sugere as etiquetas já usadas (mais usadas primeiro);
 * Enter escolhe a sugestão destacada ou cria uma etiqueta nova.
 */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const qc = useQueryClient();
  const { data: tags = [] } = useTags();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);

  const term = norm(text.replace(/^#/, ''));
  const selected = value.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as Tag[];
  const suggestions = tags
    .filter((t) => !value.includes(t.id) && (!term || norm(t.name).includes(term)))
    .sort((a, b) => {
      // Começa com o termo > contém; depois as mais usadas
      const sa = term && norm(a.name).startsWith(term) ? 0 : 1;
      const sb = term && norm(b.name).startsWith(term) ? 0 : 1;
      return sa - sb || b.video_count - a.video_count || a.name.localeCompare(b.name);
    })
    .slice(0, 8);
  const exact = tags.find((t) => norm(t.name) === term);
  const canCreate = !!term && !exact;
  // Itens do menu: sugestões + "Criar …" no fim
  const items = [...suggestions.map((t) => ({ kind: 'tag' as const, tag: t })), ...(canCreate ? [{ kind: 'create' as const }] : [])];

  const pick = (tag: Tag) => {
    onChange([...value, tag.id]);
    setText('');
    setActive(0);
    inputRef.current?.focus();
  };

  const create = async () => {
    const name = text.replace(/^#/, '').trim();
    if (!name) return;
    if (exact) {
      if (!value.includes(exact.id)) pick(exact);
      return;
    }
    setCreating(true);
    try {
      const tag = await createTag(name, randomColor());
      qc.setQueryData<Tag[]>(['tags'], (old = []) => [...old, tag]);
      void qc.invalidateQueries({ queryKey: ['tags'] });
      pick(tag);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setCreating(false);
    }
  };

  const choose = (i: number) => {
    const item = items[i];
    if (!item) return void create();
    if (item.kind === 'tag') pick(item.tag);
    else void create();
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((t) => (
            <ColorBadge key={t.id} name={`#${t.name}`} color={t.color} onRemove={() => onChange(value.filter((id) => id !== t.id))} />
          ))}
        </div>
      )}
      <div>
        <div className="relative">
        <Hash className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' || e.key === ',') {
              if (!text.trim()) return e.key === ',' && e.preventDefault();
              e.preventDefault();
              choose(active);
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={tags.length ? 'Digite para buscar etiquetas já usadas ou criar uma nova…' : 'Digite o nome da etiqueta e tecle Enter…'}
          className="pl-8"
          disabled={creating}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-autocomplete="list"
        />
        </div>
        {open && items.length > 0 && (
          <ul role="listbox" className="mt-1 max-h-56 overflow-y-auto rounded-lg border bg-white py-1 shadow-sm">
            {!term && <li className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Etiquetas já usadas</li>}
            {items.map((item, i) => (
              <li key={item.kind === 'tag' ? item.tag.id : 'create'} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm', i === active && 'bg-zinc-100')}
                >
                  {item.kind === 'tag' ? (
                    <>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.tag.color }} />
                      <span className="flex-1 truncate">{item.tag.name}</span>
                      <span className="text-xs text-muted-foreground">{plural(item.tag.video_count, 'vídeo', 'vídeos')}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="flex-1 truncate">
                        Criar etiqueta <strong>“{text.replace(/^#/, '').trim()}”</strong>
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
