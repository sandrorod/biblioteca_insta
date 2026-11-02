import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Library, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ColorPicker, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { PLACEHOLDER } from '@/components/videos/VideoCard';
import { VideoGallery } from '@/components/videos/VideoGallery';
import { useCollections, useRefreshLibrary } from '@/hooks/useTaxonomy';
import { friendlyError } from '@/services/errors';
import { deleteCollection, getCollection, saveCollection } from '@/services/taxonomy';
import type { Collection } from '@/types';
import { randomColor } from '@/utils/colors';
import { plural } from '@/utils/format';

export function CollectionsPage() {
  const { data: collections, isLoading } = useCollections();
  const refresh = useRefreshLibrary();
  const [editing, setEditing] = useState<Collection | 'new' | null>(null);
  const removeCollection = useRemoveCollection();

  return (
    <div>
      <PageHeader
        title="Coleções"
        description="Agrupe vídeos por objetivo: ideias para campanhas, referências de edição, estudos… Um vídeo pode estar em várias."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> Nova coleção
          </Button>
        }
      />
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3]" />
          ))}
        </div>
      ) : !collections?.length ? (
        <EmptyState
          icon={Library}
          title="Nenhuma coleção"
          description="Crie uma coleção e adicione vídeos pelo botão de coleções no vídeo aberto."
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus /> Criar coleção
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {collections.map((c) => (
            <div key={c.id} className="group relative overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <Link to={`/colecoes/${c.id}`} className="block">
                <div className="relative aspect-[4/3] bg-zinc-100">
                  <img src={c.display_cover_url ?? PLACEHOLDER} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.src = PLACEHOLDER)} />
                  <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: c.color }} />
                </div>
                <div className="p-3">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{plural(c.video_count, 'vídeo', 'vídeos')}</p>
                </div>
              </Link>
              <div className="absolute right-2 top-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon-sm" className="bg-white/90 shadow-sm" aria-label={`Ações de ${c.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setEditing(c)}>
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem destructive onSelect={() => removeCollection(c)}>
                      <Trash2 /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>{editing && <CollectionForm collection={editing === 'new' ? null : editing} onDone={() => { setEditing(null); refresh(); }} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function useRemoveCollection() {
  const confirm = useConfirm();
  const refresh = useRefreshLibrary();
  return async (c: Collection, after?: () => void) => {
    const ok = await confirm({
      title: `Excluir a coleção “${c.name}”?`,
      description: 'Os vídeos continuam na biblioteca; só a coleção é apagada.',
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCollection(c.id);
      toast.success('Coleção excluída.');
      refresh();
      after?.();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };
}

export function CollectionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const refresh = useRefreshLibrary();
  const removeCollection = useRemoveCollection();
  const { data: collection, isLoading } = useQuery({ queryKey: ['collection', id], queryFn: () => getCollection(id) });
  const [editing, setEditing] = useState(false);
  const base = useMemo(() => ({ collection_id: id }), [id]);

  if (isLoading) return <Skeleton className="h-10 w-64" />;
  if (!collection) return <EmptyState icon={Library} title="Coleção não encontrada" action={<Button asChild variant="outline"><Link to="/colecoes">Ver coleções</Link></Button>} />;

  return (
    <div>
      <Link to="/colecoes" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-3.5 w-3.5" /> Coleções
      </Link>
      <PageHeader
        title={collection.name}
        description={collection.description ?? 'Para remover um vídeo, abra-o e desmarque esta coleção no botão de coleções.'}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Editar
            </Button>
            <Button variant="outline" onClick={() => removeCollection(collection, () => navigate('/colecoes'))}>
              <Trash2 /> Excluir
            </Button>
          </>
        }
      />
      <VideoGallery base={base} emptyState={<EmptyState icon={Library} title="Coleção vazia" description="Abra um vídeo e use o botão de coleções para adicioná-lo aqui." />} />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>{editing && <CollectionForm collection={collection} onDone={() => { setEditing(false); refresh(); }} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function CollectionForm({ collection, onDone }: { collection: Collection | null; onDone: () => void }) {
  const [name, setName] = useState(collection?.name ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [color, setColor] = useState(collection?.color ?? randomColor());
  const [cover, setCover] = useState(collection?.cover_url ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (cover.trim() && !/^https?:\/\//i.test(cover.trim())) return toast.error('A capa precisa ser uma URL (https://…).');
    setSaving(true);
    try {
      await saveCollection({ id: collection?.id, name: name.trim(), description: description.trim() || null, color, cover_url: cover.trim() || null });
      toast.success(collection ? 'Coleção atualizada.' : 'Coleção criada.');
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
        <DialogTitle>{collection ? 'Editar coleção' : 'Nova coleção'}</DialogTitle>
      </DialogHeader>
      <Field label="Nome" htmlFor="col-name">
        <Input id="col-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
      </Field>
      <Field label="Descrição" htmlFor="col-desc">
        <Textarea id="col-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={2} />
      </Field>
      <Field label="Cor">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Capa (URL, opcional)" htmlFor="col-cover" hint="Sem capa, usa a miniatura do vídeo adicionado por último.">
        <Input id="col-cover" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" />
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
