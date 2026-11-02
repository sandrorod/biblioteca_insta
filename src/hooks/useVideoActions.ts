import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm';
import { friendlyError } from '@/services/errors';
import { deleteVideo, setArchived, setFavorite } from '@/services/videos';
import type { Video } from '@/types';
import { useRefreshLibrary } from './useTaxonomy';

/** Ações rápidas com atualização imediata da tela (otimista) e gravação no Supabase. */
export function useVideoActions() {
  const qc = useQueryClient();
  const refresh = useRefreshLibrary();
  const confirm = useConfirm();

  const patchCached = (id: string, patch: Partial<Video>) => {
    qc.setQueriesData<InfiniteData<Video[]>>({ queryKey: ['videos'] }, (data) =>
      data ? { ...data, pages: data.pages.map((p) => p.map((v) => (v.id === id ? { ...v, ...patch } : v))) } : data,
    );
    qc.setQueriesData<Video | null>({ queryKey: ['video', id] }, (v) => (v ? { ...v, ...patch } : v));
  };

  const toggleFavorite = async (video: Video) => {
    const next = !video.is_favorite;
    patchCached(video.id, { is_favorite: next });
    try {
      await setFavorite(video.id, next);
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['videos-count'] });
    } catch (err) {
      patchCached(video.id, { is_favorite: !next });
      toast.error(friendlyError(err));
    }
  };

  const toggleArchived = async (video: Video) => {
    const next = !video.is_archived;
    try {
      await setArchived(video.id, next);
      toast.success(next ? 'Vídeo arquivado.' : 'Vídeo restaurado.', {
        action: { label: 'Desfazer', onClick: () => void setArchived(video.id, !next).then(refresh) },
      });
      refresh();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const remove = async (video: Video): Promise<boolean> => {
    const ok = await confirm({
      title: 'Excluir vídeo definitivamente?',
      description: 'O vídeo, os comentários e as ligações com etiquetas e coleções serão apagados. Esta ação não pode ser desfeita. Se quiser só tirar da galeria, use “Arquivar”.',
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return false;
    try {
      await deleteVideo(video.id);
      toast.success('Vídeo excluído.');
      refresh();
      return true;
    } catch (err) {
      toast.error(friendlyError(err));
      return false;
    }
  };

  return { toggleFavorite, toggleArchived, remove, patchCached };
}
