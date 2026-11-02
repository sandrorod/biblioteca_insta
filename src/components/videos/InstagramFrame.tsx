import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { parseInstagramPost } from '@/utils/instagram';

/**
 * Geometria do player oficial do Instagram (/embed/) com 400px de largura:
 * cabeçalho de 54px e, abaixo, a mídia numa caixa 400×500. Em reels o vídeo é 9:16 no centro
 * dessa caixa (281,25×500), com faixas pretas dos lados — que aqui são cortadas.
 */
const EMBED_W = 400;
const EMBED_H = 760;
const HEADER = 54;
const BOX_H = 500;
const REEL_W = (BOX_H * 9) / 16;

interface Props {
  url: string;
  /** cover: preenche a área (grade); contain: mostra o vídeo inteiro (modal) */
  fit: 'cover' | 'contain';
  interactive?: boolean;
  /** Só carrega quando a área chega perto da tela */
  lazy?: boolean;
  title: string;
}

export const InstagramFrame = forwardRef<HTMLIFrameElement, Props>(function InstagramFrame({ url, fit, interactive = false, lazy = false, title }, ref) {
  const post = parseInstagramPost(url);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [visible, setVisible] = useState(!lazy);
  useImperativeHandle(ref, () => frame.current as HTMLIFrameElement, [visible, !!size]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    let io: IntersectionObserver | null = null;
    if (lazy) {
      io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '400px' });
      io.observe(el);
    }
    return () => {
      ro.disconnect();
      io?.disconnect();
    };
  }, [lazy]);

  if (!post) return null;
  const src = `https://www.instagram.com/${post.kind}/${post.shortcode}/embed/`;
  // Área útil da mídia dentro do player (sem cabeçalho e, em reels, sem as faixas pretas)
  const mediaW = post.kind === 'reel' ? REEL_W : EMBED_W;
  const mediaX = (EMBED_W - mediaW) / 2;

  // Janela recortada exatamente no tamanho da mídia mostrada; o player fica posicionado dentro dela
  let clip: CSSProperties = { inset: 0 };
  let frameStyle: CSSProperties = {};
  if (size && size.w > 0 && size.h > 0) {
    const scale = fit === 'cover' ? Math.max(size.w / mediaW, size.h / BOX_H) : Math.min(size.w / mediaW, size.h / BOX_H);
    const shownW = Math.min(mediaW * scale, size.w);
    const shownH = Math.min(BOX_H * scale, size.h);
    // Centro da mídia no centro da janela
    const tx = shownW / 2 - (mediaX + mediaW / 2) * scale;
    const ty = shownH / 2 - (HEADER + BOX_H / 2) * scale;
    clip = { left: (size.w - shownW) / 2, top: (size.h - shownH) / 2, width: shownW, height: shownH };
    frameStyle = { width: EMBED_W, height: EMBED_H, transform: `translate(${tx}px, ${ty}px) scale(${scale})` };
  }

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden bg-black">
      <div className="absolute overflow-hidden" style={clip}>
        {visible && size && (
          <iframe
            ref={frame}
            key={src}
            src={src}
            title={title}
            scrolling="no"
            tabIndex={interactive ? 0 : -1}
            aria-hidden={!interactive}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className={`absolute left-0 top-0 origin-top-left border-0 ${interactive ? '' : 'pointer-events-none'}`}
            style={frameStyle}
          />
        )}
      </div>
    </div>
  );
});
