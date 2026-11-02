import { useEffect, useRef, useState } from 'react';
import { instagramPostEmbedUrl } from '@/utils/instagram';

// O player oficial com 400px de largura tem um cabeçalho de 54px e, logo abaixo, a mídia em 4:5 (400×500)
const EMBED_WIDTH = 400;
const HEADER = 54;

/**
 * Capa de reserva para vídeos sem miniatura salva: o player oficial do Instagram (incorporação),
 * reduzido e recortado na área da mídia. Só é carregado quando o card chega perto da tela.
 */
export function EmbedThumb({ url, onUnavailable }: { url: string; onUnavailable: () => void }) {
  const src = instagramPostEmbedUrl(url);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!src) onUnavailable();
  }, [src, onUnavailable]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / EMBED_WIDTH));
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '400px' });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden bg-zinc-100">
      {src && visible && scale > 0 && (
        <iframe
          src={src}
          title="Capa do vídeo (Instagram)"
          tabIndex={-1}
          aria-hidden
          scrolling="no"
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width: EMBED_WIDTH, height: 760, transform: `scale(${scale}) translateY(-${HEADER}px)` }}
        />
      )}
    </div>
  );
}
