import { Clapperboard, Heart, MessageSquare } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import type { Video } from '@/types';
import { cn } from '@/utils/cn';
import { displayTitle } from '@/utils/format';
import { EmbedThumb } from './EmbedThumb';

export const PLACEHOLDER = '/placeholder.svg';

interface Props {
  video: Video;
  onOpen: (id: string) => void;
  onToggleFavorite: (video: Video) => void;
}

/** Miniatura 4:5 no estilo do Instagram: ícone de vídeo, favorito e detalhes ao passar o mouse. */
export const VideoCard = memo(function VideoCard({ video, onOpen, onToggleFavorite }: Props) {
  const [broken, setBroken] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  const onEmbedUnavailable = useCallback(() => setEmbedFailed(true), []);
  const hasImage = !!video.thumbnail_url && !broken;
  const src = hasImage ? video.thumbnail_url! : PLACEHOLDER;

  return (
    <div className="group relative aspect-[4/5] overflow-hidden bg-zinc-100 sm:rounded-sm">
      <button type="button" onClick={() => onOpen(video.id)} className="absolute inset-0 h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-label={`Abrir ${displayTitle(video.title)}`}>
        {/* Sem capa salva: usa o player oficial do Instagram como capa */}
        {!hasImage && !embedFailed && <EmbedThumb url={video.instagram_url} onUnavailable={onEmbedUnavailable} />}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className={cn('h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]', !hasImage && !embedFailed && 'invisible')}
        />
        {/* Gradiente + informações no hover (sempre visíveis no toque, de forma discreta) */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden translate-y-1 p-2.5 text-left text-white opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{displayTitle(video.title)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {video.category && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: video.category.color }}>
                {video.category.name}
              </span>
            )}
            {video.tags.slice(0, 3).map((t) => (
              <span key={t.id} className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                #{t.name}
              </span>
            ))}
            {video.tags.length > 3 && <span className="text-[10px] text-white/80">+{video.tags.length - 3}</span>}
          </div>
        </div>
      </button>

      <Clapperboard className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      {video.comments_count > 0 && (
        <span className="pointer-events-none absolute right-2 top-8 flex items-center gap-0.5 text-[10px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          <MessageSquare className="h-3 w-3" />
          {video.comments_count}
        </span>
      )}
      <button
        type="button"
        onClick={() => onToggleFavorite(video)}
        aria-label={video.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        aria-pressed={video.is_favorite}
        className={cn(
          'absolute left-1.5 top-1.5 rounded-full p-1.5 transition',
          video.is_favorite ? 'opacity-100' : 'opacity-0 hover:bg-black/20 focus-visible:opacity-100 group-hover:opacity-100',
        )}
      >
        <Heart className={cn('h-4 w-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]', video.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-white')} />
      </button>
    </div>
  );
});
