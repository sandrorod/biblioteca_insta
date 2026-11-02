import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { countVideos, cursorOf, listVideos, PAGE_SIZE } from '@/services/videos';
import type { SortOption, Video, VideoFilters } from '@/types';
import { cleanFilters } from '@/utils/filters';

/**
 * Galeria com carregamento progressivo: 24 por vez, cursor (sort_key + id) da última linha,
 * filtros e pesquisa aplicados no banco. Mudar filtros/ordenação recomeça do primeiro lote.
 */
export function useInfiniteVideos(filters: VideoFilters, sort: SortOption) {
  const clean = useMemo(() => cleanFilters(filters), [filters]);

  const query = useInfiniteQuery({
    queryKey: ['videos', clean, sort],
    initialPageParam: null as ReturnType<typeof cursorOf> | null,
    queryFn: ({ pageParam }) => listVideos(clean, sort, pageParam),
    getNextPageParam: (last) => (last.length === PAGE_SIZE ? cursorOf(last[last.length - 1]) : undefined),
  });

  const count = useQuery({
    queryKey: ['videos-count', clean],
    queryFn: () => countVideos(clean),
  });

  // Junta as páginas sem repetir (um vídeo editado entre duas páginas poderia reaparecer)
  const videos = useMemo(() => {
    const seen = new Set<string>();
    const out: Video[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const v of page) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        out.push(v);
      }
    }
    return out;
  }, [query.data]);

  return { ...query, videos, total: count.data, totalLoading: count.isLoading };
}
