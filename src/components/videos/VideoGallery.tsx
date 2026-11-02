import { AlertCircle, ArrowUpDown, Grid2x2, Grid3x3, LayoutGrid, Loader2, RotateCw, SearchX, Video as VideoIcon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useGalleryParams } from '@/hooks/useGalleryParams';
import { useInfiniteVideos } from '@/hooks/useInfiniteVideos';
import { useIntersection } from '@/hooks/useIntersection';
import { useVideoActions } from '@/hooks/useVideoActions';
import { friendlyError } from '@/services/errors';
import type { VideoFilters } from '@/types';
import { cn } from '@/utils/cn';
import { activeFilterCount, SORT_OPTIONS } from '@/utils/filters';
import { plural } from '@/utils/format';
import { ActiveFilters, FiltersPanel } from './FiltersPanel';
import { SearchBar } from './SearchBar';
import { VideoCard } from './VideoCard';
import { VideoModal } from './VideoModal';

// v2: o padrão passou a ser 5 colunas (escolhas antigas de 3 colunas não se mantêm)
const DENSITY_KEY = 'biblioteca:density:v2';
const DENSITIES = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' } as const;
type Density = keyof typeof DENSITIES;

function readDensity(): Density {
  try {
    const v = Number(localStorage.getItem(DENSITY_KEY));
    return v === 3 || v === 4 ? v : 5;
  } catch {
    return 5;
  }
}

interface Props {
  /** Filtros fixos da página (favoritos, arquivados, coleção) */
  base?: VideoFilters;
  locked?: (keyof VideoFilters)[];
  emptyState?: ReactNode;
}

/**
 * Galeria principal: pesquisa, filtros e ordenação no banco; 24 vídeos por vez com Intersection Observer.
 * Os registros já carregados ficam na tela; ao mudar filtros, recomeça do primeiro lote.
 */
export function VideoGallery({ base, locked = [], emptyState }: Props) {
  const { filters, sort, setFilters, setSort, openId, setOpenId } = useGalleryParams();
  const effective = useMemo(() => ({ ...filters, ...base }), [filters, base]);
  const { videos, total, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch } = useInfiniteVideos(effective, sort);
  const { toggleFavorite } = useVideoActions();
  const [density, setDensity] = useState<Density>(readDensity);

  // Uma requisição por vez: a trava (ref) vale já no mesmo instante, antes de o estado "carregando" chegar à tela
  const inFlight = useRef(false);
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || isError || inFlight.current) return;
    inFlight.current = true;
    void fetchNextPage({ cancelRefetch: false }).finally(() => {
      inFlight.current = false;
    });
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  const sentinel = useIntersection<HTMLDivElement>(loadMore, { enabled: !!hasNextPage && !isError });

  const changeDensity = (d: Density) => {
    setDensity(d);
    try {
      localStorage.setItem(DENSITY_KEY, String(d));
    } catch {
      /* armazenamento indisponível: só não lembra a escolha */
    }
  };

  const filtering = !!filters.search?.trim() || activeFilterCount(filters) > 0;
  const openIndex = openId ? videos.findIndex((v) => v.id === openId) : -1;

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-3 space-y-2 border-b border-transparent bg-zinc-50/90 px-4 pb-3 pt-1 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/75 md:-mx-8 md:px-8">
        <div className="flex gap-2">
          <SearchBar value={filters.search ?? ''} onChange={(search) => setFilters({ ...filters, search: search || undefined })} onApplyFilter={(patch) => setFilters({ ...filters, ...patch })} />
          <FiltersPanel filters={filters} onChange={setFilters} locked={locked} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 shrink-0" aria-label="Ordenar">
                <ArrowUpDown />
                <span className="hidden lg:inline">{SORT_OPTIONS.find((o) => o.value === sort)?.label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuItem key={o.value} onSelect={() => setSort(o.value)} className={cn(o.value === sort && 'font-semibold')}>
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex min-h-6 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {total === undefined ? 'Contando…' : filtering ? `${plural(total, 'resultado', 'resultados')}` : plural(total, 'vídeo', 'vídeos')}
            </span>
            <ActiveFilters filters={filters} onChange={setFilters} locked={locked} />
          </div>
          <div className="hidden items-center rounded-md border bg-white p-0.5 lg:flex" role="group" aria-label="Colunas da grade">
            {([3, 4, 5] as Density[]).map((d) => {
              const Icon = d === 3 ? Grid3x3 : d === 4 ? LayoutGrid : Grid2x2;
              return (
                <button key={d} type="button" onClick={() => changeDensity(d)} className={cn('rounded p-1 text-zinc-400 hover:text-zinc-800', density === d && 'bg-zinc-100 text-zinc-900')} aria-label={`${d} colunas`} aria-pressed={density === d}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={cn('grid grid-cols-3 gap-0.5 sm:gap-1', DENSITIES[density])}>
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-none sm:rounded-sm" />
          ))}
        </div>
      ) : isError && videos.length === 0 ? (
        <ErrorBox message={friendlyError(error)} onRetry={() => void refetch()} />
      ) : videos.length === 0 ? (
        filtering ? (
          <EmptyState icon={SearchX} title="Nenhum vídeo encontrado" description="Tente outras palavras ou remova alguns filtros." action={<Button variant="outline" onClick={() => setFilters({})}>Limpar pesquisa e filtros</Button>} />
        ) : (
          (emptyState ?? <EmptyState icon={VideoIcon} title="Nenhum vídeo por aqui" description="Cadastre o primeiro vídeo colando um link do Instagram." />)
        )
      ) : (
        <>
          <div className={cn('-mx-4 grid grid-cols-3 gap-0.5 sm:mx-0 sm:gap-1', DENSITIES[density])}>
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} onOpen={setOpenId} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
          <div ref={sentinel} aria-hidden data-testid="gallery-sentinel" className="h-px" />
          <div className="flex justify-center py-8">
            {isFetchingNextPage ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando mais vídeos…
              </span>
            ) : isError ? (
              <ErrorBox message={friendlyError(error)} onRetry={() => void fetchNextPage()} compact />
            ) : !hasNextPage && videos.length > 0 ? (
              <span className="text-xs text-muted-foreground">Fim da lista · {plural(videos.length, 'vídeo', 'vídeos')}</span>
            ) : null}
          </div>
        </>
      )}

      {openId && (
        <VideoModal
          videoId={openId}
          list={videos}
          index={openIndex}
          hasMore={!!hasNextPage}
          loadMore={() => fetchNextPage()}
          onNavigate={setOpenId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function ErrorBox({ message, onRetry, compact }: { message: string; onRetry: () => void; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', compact ? '' : 'rounded-xl border border-red-100 bg-red-50/50 px-6 py-12')}>
      <span className="flex items-center gap-2 text-sm text-red-700">
        <AlertCircle className="h-4 w-4" /> Não foi possível carregar os vídeos. {message}
      </span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw /> Tentar novamente
      </Button>
    </div>
  );
}
