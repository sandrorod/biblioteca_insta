// Leitura da resposta do endpoint /post-dl da API "Instagram Looter" (RapidAPI).
// Módulo puro (sem Deno/Node): usado pela Edge Function e testado pelo Vitest.

export interface LooterMedia {
  type?: string;
  link?: string;
  img?: string;
}

export interface LooterPost {
  status?: boolean;
  errorMessage?: string;
  data?: {
    username?: string;
    full_name?: string;
    caption?: string | null;
    like_count?: number | null;
    comment_count?: number | null;
    taken_at_timestamp?: number | null;
    medias?: LooterMedia[];
  };
}

export interface InstagramInfo {
  username: string | null;
  authorName: string | null;
  caption: string | null;
  likeCount: number | null;
  commentCount: number | null;
  takenAt: string | null;
  /** Data da publicação no fuso de Brasília (AAAA-MM-DD) */
  publishDate: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
}

const count = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null);
const text = (s: unknown) => (typeof s === 'string' && s.trim() ? s.trim() : null);

export function parseLooterPost(body: LooterPost): InstagramInfo | null {
  const d = body?.data;
  if (!body?.status || !d) return null;
  const medias = Array.isArray(d.medias) ? d.medias : [];
  const video = medias.find((m) => m?.type === 'video' && m.link);
  const ts = typeof d.taken_at_timestamp === 'number' && d.taken_at_timestamp > 0 ? d.taken_at_timestamp : null;
  return {
    username: text(d.username),
    authorName: text(d.full_name),
    caption: text(d.caption),
    likeCount: count(d.like_count),
    commentCount: count(d.comment_count),
    takenAt: ts ? new Date(ts * 1000).toISOString() : null,
    publishDate: ts ? new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : null,
    videoUrl: video?.link ?? null,
    imageUrl: video?.img ?? medias.find((m) => m?.img)?.img ?? null,
  };
}

/** Título sugerido: primeira linha da legenda, sem hashtags no fim, até 120 caracteres. */
export function titleFromCaption(caption: string | null): string | null {
  const first = caption?.split('\n').map((l) => l.trim()).find(Boolean);
  if (!first) return null;
  const clean = first.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, '').trim() || first;
  return clean.length > 120 ? `${clean.slice(0, 117).trimEnd()}…` : clean;
}

/** Só baixa dos servidores de mídia do próprio Instagram/Facebook. */
export function isInstagramCdn(url: string | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i.test(u.hostname);
  } catch {
    return false;
  }
}
