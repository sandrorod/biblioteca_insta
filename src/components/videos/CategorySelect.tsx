import { useQueryClient } from '@tanstack/react-query';
import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCategories } from '@/hooks/useTaxonomy';
import { friendlyError } from '@/services/errors';
import { createCategory } from '@/services/taxonomy';
import { randomColor } from '@/utils/colors';

const selectCls =
  'h-9 w-full min-w-0 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20';

/** Categoria principal do vídeo, com a opção de criar uma nova na hora (já fica selecionada). */
export function CategorySelect({ id, value, onChange }: { id?: string; value: string | null; onChange: (id: string | null) => void }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const category = await createCategory(name, randomColor(), categories.length);
      qc.setQueryData(['categories'], [...categories, category]);
      void qc.invalidateQueries({ queryKey: ['categories'] });
      onChange(category.id);
      setName('');
      setCreating(false);
      toast.success(`Categoria “${category.name}” criada.`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    return (
      <div className="flex gap-1.5">
        <Input
          id={id}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void create();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setCreating(false);
            }
          }}
          placeholder="Nome da nova categoria"
          maxLength={80}
          autoFocus
        />
        <Button type="button" size="icon" onClick={create} loading={saving} disabled={!name.trim()} aria-label="Criar categoria">
          {!saving && <Check />}
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => setCreating(false)} aria-label="Cancelar">
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={selectCls}>
        <option value="">Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="button" variant="outline" className="shrink-0" onClick={() => setCreating(true)}>
        <Plus /> Nova
      </Button>
    </div>
  );
}
