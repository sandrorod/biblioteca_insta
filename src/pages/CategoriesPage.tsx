import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Folder, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, ColorPicker, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useCategories, useRefreshLibrary } from '@/hooks/useTaxonomy';
import { friendlyError } from '@/services/errors';
import { deleteCategory, reorderCategories, saveCategory } from '@/services/taxonomy';
import type { Category } from '@/types';
import { randomColor } from '@/utils/colors';
import { plural } from '@/utils/format';

export function CategoriesPage() {
  const qc = useQueryClient();
  const refresh = useRefreshLibrary();
  const { data: categories, isLoading } = useCategories();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const move = async (index: number, dir: -1 | 1) => {
    if (!categories) return;
    const next = [...categories];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    qc.setQueryData(['categories'], next);
    try {
      await reorderCategories(next.map((c) => c.id));
    } catch (err) {
      toast.error(friendlyError(err));
      refresh();
    }
  };

  return (
    <div>
      <PageHeader
        title="Categorias"
        description="Cada vídeo pode ter uma categoria principal. Use as setas para reorganizar."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> Nova categoria
          </Button>
        }
      />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !categories?.length ? (
        <EmptyState icon={Folder} title="Nenhuma categoria" description="Crie categorias como “Edição”, “Campanhas” ou “Tutoriais”." action={<Button onClick={() => setEditing('new')}><Plus /> Criar categoria</Button>} />
      ) : (
        <Card className="divide-y">
          {categories.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex flex-col">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-20" aria-label={`Subir ${c.name}`}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={i === categories.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-20" aria-label={`Descer ${c.name}`}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="h-9 w-9 shrink-0 rounded-lg" style={{ backgroundColor: c.color }} />
              <Link to={`/videos?category_id=${c.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium hover:underline">{c.name}</p>
                {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
              </Link>
              <Link to={`/videos?category_id=${c.id}`} className="shrink-0 text-xs text-muted-foreground hover:text-zinc-900">
                {plural(c.video_count, 'vídeo', 'vídeos')}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${c.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setEditing(c)}>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => setDeleting(c)}>
                    <Trash2 /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>{editing && <CategoryForm category={editing === 'new' ? null : editing} position={categories?.length ?? 0} onDone={() => { setEditing(null); refresh(); }} />}</DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>{deleting && <DeleteCategory category={deleting} others={(categories ?? []).filter((c) => c.id !== deleting.id)} onDone={() => { setDeleting(null); refresh(); }} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({ category, position, onDone }: { category: Category | null; position: number; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [color, setColor] = useState(category?.color ?? randomColor());
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveCategory({ id: category?.id, name: name.trim(), description: description.trim() || null, color, ...(category ? {} : { position }) });
      toast.success(category ? 'Categoria atualizada.' : 'Categoria criada.');
      onDone();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{category ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
      </DialogHeader>
      <Field label="Nome" htmlFor="c-name">
        <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
      </Field>
      <Field label="Descrição" htmlFor="c-desc">
        <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
      </Field>
      <Field label="Cor">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving} disabled={!name.trim()}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteCategory({ category, others, onDone }: { category: Category; others: Category[]; onDone: () => void }) {
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      await deleteCategory(category.id, target || null);
      toast.success('Categoria excluída.');
      onDone();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Excluir “{category.name}”?</DialogTitle>
        <DialogDescription>
          {category.video_count > 0 ? `${plural(category.video_count, 'vídeo usa', 'vídeos usam')} esta categoria. Escolha o que fazer com eles.` : 'Nenhum vídeo usa esta categoria.'}
        </DialogDescription>
      </DialogHeader>
      {category.video_count > 0 && (
        <Field label="Mover os vídeos para" htmlFor="c-target">
          <select id="c-target" value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm shadow-sm">
            <option value="">Deixar sem categoria</option>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={confirm} loading={saving}>
          Excluir categoria
        </Button>
      </DialogFooter>
    </div>
  );
}
