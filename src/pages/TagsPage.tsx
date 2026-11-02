import { Hash, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, ColorPicker, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useRefreshLibrary, useTags } from '@/hooks/useTaxonomy';
import { friendlyError } from '@/services/errors';
import { createTag, deleteTag, updateTag } from '@/services/taxonomy';
import type { Tag } from '@/types';
import { randomColor } from '@/utils/colors';
import { plural } from '@/utils/format';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function TagsPage() {
  const { data: tags, isLoading } = useTags();
  const refresh = useRefreshLibrary();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Tag | 'new' | null>(null);
  const visible = (tags ?? []).filter((t) => norm(t.name).includes(norm(search.trim())));

  const remove = async (t: Tag) => {
    const ok = await confirm({
      title: `Excluir a etiqueta “${t.name}”?`,
      description: t.video_count ? `Ela será removida de ${plural(t.video_count, 'vídeo', 'vídeos')}. Os vídeos não são apagados.` : undefined,
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTag(t.id);
      toast.success('Etiqueta excluída.');
      refresh();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Etiquetas"
        description="Um vídeo pode ter várias etiquetas. Também dá para criá-las direto no cadastro do vídeo."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> Nova etiqueta
          </Button>
        }
      />
      {(tags?.length ?? 0) > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar etiquetas…" className="pl-9" />
        </div>
      )}
      {isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !tags?.length ? (
        <EmptyState icon={Hash} title="Nenhuma etiqueta" description="Etiquetas ajudam a achar vídeos por tema, formato ou ideia." action={<Button onClick={() => setEditing('new')}><Plus /> Criar etiqueta</Button>} />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma etiqueta encontrada.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <Card key={t.id} className="group flex items-center gap-3 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold" style={{ backgroundColor: `${t.color}1a`, color: t.color }}>
                #
              </span>
              <Link to={`/videos?tags=${t.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium hover:underline">{t.name}</p>
                <p className="text-xs text-muted-foreground">{plural(t.video_count, 'vídeo', 'vídeos')}</p>
              </Link>
              <div className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(t)} aria-label={`Editar ${t.name}`}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(t)} aria-label={`Excluir ${t.name}`}>
                  <Trash2 />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>{editing && <TagForm tag={editing === 'new' ? null : editing} onDone={() => { setEditing(null); refresh(); }} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function TagForm({ tag, onDone }: { tag: Tag | null; onDone: () => void }) {
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? randomColor());
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (tag) await updateTag(tag.id, { name: name.replace(/^#/, ''), color });
      else await createTag(name.replace(/^#/, ''), color);
      toast.success(tag ? 'Etiqueta atualizada.' : 'Etiqueta criada.');
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
        <DialogTitle>{tag ? 'Editar etiqueta' : 'Nova etiqueta'}</DialogTitle>
      </DialogHeader>
      <Field label="Nome" htmlFor="t-name">
        <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
      </Field>
      <Field label="Cor">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving} disabled={!name.replace(/^#/, '').trim()}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
