import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { InfiniteData } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Library,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ColorBadge } from '@/components/ui/misc';
import { useRefreshLibrary } from '@/hooks/useTaxonomy';
import { useVideoActions } from '@/hooks/useVideoActions';
import { getVideo } from '@/services/videos';
import type { Video } from '@/types';
import { cn } from '@/utils/cn';
import { displayTitle, formatDate, formatDateTime } from '@/utils/format';
import { instagramEmbedUrl } from '@/utils/instagram';
import { CollectionPicker } from './CollectionPicker';
import { CommentsPanel } from './CommentsPanel';
import { PLACEHOLDER } from './VideoCard';
import { useVideoEditor } from './VideoEditor';

interface Props {
  videoId: string;
  /** Vídeos já carregados na galeria (respeitam pesquisa, filtros e ordenação) */
  list: Video[];
  index: number;
  hasMore: boolean;
  loadMore: () => Promise<{ data?: InfiniteData<Video[]> }>;
  onNavigate: (id: string) => void;
  onClose: () => void;
}

/** Visualização do vídeo: player/capa à esquerda, informações à direita (empilhado no celular). */
export function VideoModal({ videoId, list, index, hasMore, loadMore, onNavigate, onClose }: Props) {
  const fromList = index >= 0 ? list[index] : null;
  // Aberto por link direto (?video=…) e ainda não carregado na grade: busca sozinho
  const single = useQuery({ queryKey: ['video', videoId], queryFn: () => getVideo(videoId), enabled: !fromList });
  const video = fromList ?? single.data ?? null;
  const [loadingNext, setLoadingNext] = useState(false);

  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  const canNext = !!next || (index >= 0 && hasMore);

  const goNext = async () => {
    if (next) return onNavigate(next.id);
    if (!hasMore || loadingNext) return;
    setLoadingNext(true);
    try {
      const r = await loadMore();
      const all = r.data?.pages.flat() ?? [];
      const i = all.findIndex((v) => v.id === videoId);
      if (i >= 0 && all[i + 1]) onNavigate(all[i + 1].id);
    } finally {
      setLoadingNext(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft' && prev) onNavigate(prev.id);
      if (e.key === 'ArrowRight') void goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-zinc-950/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-40 flex items-stretch justify-center outline-none md:items-center md:p-6"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* Navegação lateral (desktop) */}
          {prev && (
            <button type="button" onClick={() => onNavigate(prev.id)} className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg transition hover:bg-white md:block" aria-label="Vídeo anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {canNext && (
            <button type="button" onClick={() => void goNext()} className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg transition hover:bg-white md:block" aria-label="Próximo vídeo">
              {loadingNext ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          )}
          <DialogPrimitive.Close className="absolute right-3 top-3 z-10 hidden rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white md:block" aria-label="Fechar">
            <X className="h-6 w-6" />
          </DialogPrimitive.Close>

          <div className="relative flex h-full w-full flex-col overflow-hidden bg-white data-[state=open]:animate-in md:h-[min(88vh,860px)] md:max-w-6xl md:flex-row md:rounded-xl md:shadow-2xl">
            {!video ? (
              single.isLoading ? (
                <div className="flex flex-1 items-center justify-center p-10">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                  <DialogPrimitive.Title className="font-semibold">Vídeo não encontrado</DialogPrimitive.Title>
                  <p className="text-sm text-muted-foreground">Ele pode ter sido excluído.</p>
                  <Button variant="outline" onClick={onClose}>
                    Fechar
                  </Button>
                </div>
              )
            ) : (
              <ModalBody video={video} onClose={onClose} prev={prev} canNext={canNext} onPrev={() => prev && onNavigate(prev.id)} onNext={() => void goNext()} />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ModalBody({ video, onClose, prev, canNext, onPrev, onNext }: { video: Video; onClose: () => void; prev: Video | null; canNext: boolean; onPrev: () => void; onNext: () => void }) {
  const { toggleFavorite, toggleArchived, remove } = useVideoActions();
  const editor = useVideoEditor();
  const refresh = useRefreshLibrary();
  const embed = instagramEmbedUrl(video.instagram_url);
  const [mode, setMode] = useState<'player' | 'cover'>(embed ? 'player' : 'cover');
  const [imgBroken, setImgBroken] = useState(false);

  useEffect(() => {
    setMode(embed ? 'player' : 'cover');
    setImgBroken(false);
  }, [video.id, embed]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(video.instagram_url);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  return (
    <>
      {/* Mídia */}
      <div className="relative flex shrink-0 flex-col bg-zinc-950 md:w-[min(52%,560px)] md:shrink">
        <div className="flex items-center justify-between gap-2 px-3 py-2 md:hidden">
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-white/90 hover:bg-white/10" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
          <div className="flex gap-1">
            <button type="button" disabled={!prev} onClick={onPrev} className="rounded-full p-1.5 text-white/90 hover:bg-white/10 disabled:opacity-30" aria-label="Vídeo anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" disabled={!canNext} onClick={onNext} className="rounded-full p-1.5 text-white/90 hover:bg-white/10 disabled:opacity-30" aria-label="Próximo vídeo">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="relative h-[52vh] md:h-full">
          {mode === 'player' && embed ? (
            <iframe
              key={video.id}
              src={embed}
              title={`Publicação do Instagram: ${displayTitle(video.title)}`}
              className="h-full w-full bg-white"
              loading="lazy"
              allow="encrypted-media; picture-in-picture; clipboard-write"
              allowFullScreen
            />
          ) : (
            <img
              src={!video.thumbnail_url || imgBroken ? PLACEHOLDER : video.thumbnail_url}
              onError={() => setImgBroken(true)}
              alt=""
              className="h-full w-full object-contain"
            />
          )}
        </div>
        {embed && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 rounded-full bg-black/60 p-0.5 text-xs text-white backdrop-blur">
            <button type="button" onClick={() => setMode('player')} className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', mode === 'player' && 'bg-white text-zinc-900')}>
              <PlayCircle className="h-3.5 w-3.5" /> Player
            </button>
            <button type="button" onClick={() => setMode('cover')} className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', mode === 'cover' && 'bg-white text-zinc-900')}>
              <ImageIcon className="h-3.5 w-3.5" /> Capa
            </button>
          </div>
        )}
      </div>

      {/* Informações */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          {video.profile_name ? (
            <Link to={`/videos?profile=${encodeURIComponent(video.profile_name)}`} onClick={onClose} className="flex min-w-0 items-center gap-2 text-sm font-semibold hover:underline">
              <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white">
                <User className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">@{video.profile_name}</span>
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Perfil não informado</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => toggleFavorite(video)} aria-label={video.is_favorite ? 'Remover dos favoritos' : 'Favoritar'} aria-pressed={video.is_favorite}>
              <Heart className={cn(video.is_favorite && 'fill-rose-500 text-rose-500')} />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => editor.openEdit(video)} aria-label="Editar">
              <Pencil />
            </Button>
            <CollectionPicker
              videoId={video.id}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Coleções">
                  <Library />
                </Button>
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <a href={video.instagram_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Abrir no Instagram
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={copyLink}>
                  <Copy /> Copiar link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => toggleArchived(video).then(onClose)}>
                  {video.is_archived ? <ArchiveRestore /> : <Archive />} {video.is_archived ? 'Restaurar' : 'Arquivar'}
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => void remove(video).then((ok) => ok && onClose())}>
                  <Trash2 /> Excluir definitivamente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div>
            <DialogPrimitive.Title className={cn('text-lg font-semibold leading-snug', !video.title && 'text-muted-foreground')}>{displayTitle(video.title)}</DialogPrimitive.Title>
            {video.is_archived && <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">Arquivado</span>}
            {video.description ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-700">{video.description}</p>
            ) : (
              <button type="button" onClick={() => editor.openEdit(video)} className="mt-2 text-sm text-muted-foreground hover:text-zinc-900">
                + Adicionar descrição
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {video.category ? (
              <Link to={`/videos?category_id=${video.category.id}`} onClick={onClose}>
                <ColorBadge name={video.category.name} color={video.category.color} className="rounded-md" />
              </Link>
            ) : (
              <span className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">Sem categoria</span>
            )}
            {video.tags.map((t) => (
              <Link key={t.id} to={`/videos?tags=${t.id}`} onClick={onClose}>
                <ColorBadge name={`#${t.name}`} color={t.color} />
              </Link>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-zinc-50/60 p-3 text-xs">
            <div>
              <dt className="flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> Publicação
              </dt>
              <dd className="mt-0.5 font-medium">{formatDate(video.original_publish_date)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cadastro</dt>
              <dd className="mt-0.5 font-medium">{formatDateTime(video.created_at)}</dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-muted-foreground">Link original</dt>
              <dd className="mt-0.5 truncate">
                <a href={video.instagram_url} target="_blank" rel="noopener noreferrer" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
                  {video.instagram_url}
                </a>
              </dd>
            </div>
          </dl>

          {video.notes && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações internas</h3>
              <p className="whitespace-pre-wrap break-words rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-sm text-zinc-800">{video.notes}</p>
            </section>
          )}

          <CommentsPanel videoId={video.id} onChanged={refresh} />
        </div>

        <div className="border-t p-3">
          <Button asChild variant="brand" className="w-full">
            <a href={video.instagram_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Abrir no Instagram
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}
