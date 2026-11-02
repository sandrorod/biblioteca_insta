import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderPlus, Library, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCollections } from '@/hooks/useTaxonomy';
import { friendlyError } from '@/services/errors';
import { collectionsOfVideo, saveCollection, setVideoInCollection } from '@/services/taxonomy';
import { randomColor } from '@/utils/colors';

/** Adiciona/remove o vídeo de coleções (um vídeo pode estar em várias). */
export function CollectionPicker({ videoId, trigger }: { videoId: string; trigger?: ReactNode }) {
  const qc = useQueryClient();
  const { data: collections = [] } = useCollections();
  const [open, setOpen] = useState(false);
  const membership = useQuery({ queryKey: ['video-collections', videoId], queryFn: () => collectionsOfVideo(videoId), enabled: open });
  const [newName, setNewName] = useState('');
  const inside = new Set(membership.data ?? []);

  const toggle = async (collectionId: string) => {
    const next = !inside.has(collectionId);
    qc.setQueryData<string[]>(['video-collections', videoId], (ids = []) => (next ? [...ids, collectionId] : ids.filter((i) => i !== collectionId)));
    try {
      await setVideoInCollection(collectionId, videoId, next);
      void qc.invalidateQueries({ queryKey: ['collections'] });
      void qc.invalidateQueries({ queryKey: ['videos'] });
    } catch (err) {
      toast.error(friendlyError(err));
      void membership.refetch();
    }
  };

  const create = async () => {
    if (!newName.trim()) return;
    try {
      await saveCollection({ name: newName.trim(), description: null, color: randomColor(), cover_url: null });
      setNewName('');
      await qc.invalidateQueries({ queryKey: ['collections'] });
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Library /> Coleções
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <p className="px-1 pb-1.5 text-xs font-semibold text-muted-foreground">Salvar em coleções</p>
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {collections.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Nenhuma coleção ainda.</p>}
          {collections.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-zinc-50">
              <input type="checkbox" checked={inside.has(c.id)} onChange={() => toggle(c.id)} disabled={membership.isLoading} />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.video_count}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-1 border-t pt-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} placeholder="Nova coleção" className="h-8" />
          <Button size="icon-sm" variant="outline" onClick={create} disabled={!newName.trim()} aria-label="Criar coleção">
            {newName ? <Plus /> : <FolderPlus />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
