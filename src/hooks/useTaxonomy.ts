import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listCategories, listCollections, listTags } from '@/services/taxonomy';

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: listCategories, staleTime: 60_000 });
export const useTags = () => useQuery({ queryKey: ['tags'], queryFn: listTags, staleTime: 60_000 });
export const useCollections = () => useQuery({ queryKey: ['collections'], queryFn: listCollections, staleTime: 60_000 });

/** Depois de qualquer alteração: recarrega galeria, contagens, painel e listas. */
export function useRefreshLibrary() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['videos', 'videos-count', 'dashboard', 'categories', 'tags', 'collections', 'collection', 'video']) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}
