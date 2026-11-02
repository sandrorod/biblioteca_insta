import { useEffect, useRef } from 'react';

/** Chama onEnter quando o elemento sentinela se aproxima da área visível (rootMargin antecipa o carregamento). */
export function useIntersection<T extends Element>(onEnter: () => void, { enabled = true, rootMargin = '800px' } = {}) {
  const ref = useRef<T | null>(null);
  const cb = useRef(onEnter);
  cb.current = onEnter;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && cb.current(), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}
