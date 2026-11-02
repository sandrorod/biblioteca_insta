/** Utilidades para links do Instagram (sem chamadas externas). */

const POST_RE = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]+)/i;
const PROFILE_RE = /instagram\.com\/([A-Za-z0-9_.]+)\/?(?:[?#].*)?$/i;
const RESERVED = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct']);

export interface InstagramPost {
  kind: 'p' | 'reel' | 'tv';
  shortcode: string;
}

/** Tipo e código curto da publicação; null se o link não for de uma publicação. */
export function parseInstagramPost(url: string): InstagramPost | null {
  const m = url.trim().match(POST_RE);
  if (!m) return null;
  const kind = m[1].toLowerCase().startsWith('reel') ? 'reel' : (m[1].toLowerCase() as 'p' | 'tv');
  return { kind, shortcode: m[2] };
}

export function isInstagramUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return /(^|\.)instagram\.com$/i.test(u.hostname) || /(^|\.)instagr\.am$/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Link limpo (sem parâmetros de rastreamento como ?igsh=). */
export function normalizeInstagramUrl(url: string): string {
  const raw = url.trim();
  const post = parseInstagramPost(raw);
  if (post) return `https://www.instagram.com/${post.kind}/${post.shortcode}/`;
  try {
    const u = new URL(raw);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return raw;
  }
}

/** Mesma chave usada no banco (biblioteca_instagram_key) para checar duplicidade. */
export function instagramKey(url: string): string {
  const post = parseInstagramPost(url);
  if (post) return post.shortcode;
  return url.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
}

/** Endereço do player oficial de incorporação do Instagram. */
export function instagramEmbedUrl(url: string): string | null {
  const post = parseInstagramPost(url);
  return post ? `https://www.instagram.com/${post.kind}/${post.shortcode}/embed/captioned/` : null;
}

/** Perfil a partir de um link de perfil (instagram.com/usuario). */
export function profileFromUrl(url: string): string | null {
  const m = url.trim().match(PROFILE_RE);
  if (!m || RESERVED.has(m[1].toLowerCase())) return null;
  return m[1];
}
