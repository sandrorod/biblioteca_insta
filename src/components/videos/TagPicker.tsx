import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { ColorBadge } from '@/components/ui/misc';
import { useTags } from '@/hooks/useTaxonomy';
import { friendlyError } from '@/services/errors';
import { createTag } from '@/services/taxonomy';
import { randomColor } from '@/utils/colors';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Escolhe várias etiquetas e cria novas na hora (Enter ou vírgula). */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const qc = useQueryClient();
  const { data: tags = [] } = useTags();
  const [text, setText] = useState('');
  const [creating, setCreating] = useState(false);
  const selected = value.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as typeof tags;
  const term = norm(text);
  const options = tags.filter((t) => !value.includes(t.id) && (!term || norm(t.name).includes(term))).slice(0, 12);
  const exact = tags.find((t) => norm(t.name) === term);

  const addOrCreate = async () => {
    const name = text.replace(/^#/, '').trim();
    if (!name) return;
    if (exact) {
      if (!value.includes(exact.id)) onChange([...value, exact.id]);
      setText('');
      return;
    }
    setCreating(true);
    try {
      const tag = await createTag(name, randomColor());
      qc.setQueryData(['tags'], (old: typeof tags = []) => [...old, tag].sort((a, b) => a.name.localeCompare(b.name)));
      onChange([...value, tag.id]);
      setText('');
      void qc.invalidateQueries({ queryKey: ['tags'] });
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setCreating(false);
    }
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
      <div className="relative">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              void addOrCreate();
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder="Digite para buscar ou criar etiquetas…"
          disabled={creating}
        />
      </div>
      {(options.length > 0 || (term && !exact)) && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((t) => (
            <button key={t.id} type="button" onClick={() => { onChange([...value, t.id]); setText(''); }} className="opacity-80 transition hover:opacity-100">
              <ColorBadge name={`#${t.name}`} color={t.color} />
            </button>
          ))}
          {term && !exact && (
            <button type="button" onClick={addOrCreate} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900">
              <Plus className="h-3 w-3" /> Criar “{text.replace(/^#/, '').trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
