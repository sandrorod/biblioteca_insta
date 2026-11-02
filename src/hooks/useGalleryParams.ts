import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortOption, VideoFilters } from '@/types';
import { filtersFromParams, paramsFromFilters } from '@/utils/filters';

/** Filtros, ordenação e vídeo aberto ficam na URL. */
export function useGalleryParams() {
  const [params, setParams] = useSearchParams();
  const { filters, sort } = useMemo(() => filtersFromParams(params), [params]);
  const openId = params.get('video');

  const update = useCallback(
    (next: { filters?: VideoFilters; sort?: SortOption }) => {
      setParams(
        (prev) => {
          const cur = filtersFromParams(prev);
          const p = paramsFromFilters(next.filters ?? cur.filters, next.sort ?? cur.sort);
          const video = prev.get('video');
          if (video) p.set('video', video);
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setOpenId = useCallback(
    (id: string | null) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (id) p.set('video', id);
          else p.delete('video');
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { filters, sort, setFilters: (f: VideoFilters) => update({ filters: f }), setSort: (s: SortOption) => update({ sort: s }), openId, setOpenId };
}
