// Edge Function: capa e autor de uma publicação do Instagram pela API oficial (oEmbed da Meta).
//
// Requer o segredo META_OEMBED_TOKEN ("APP_ID|CLIENT_TOKEN" de um app da Meta com o produto oEmbed).
// Sem o segredo, responde { available: false } e o app segue com upload/URL manual.
// A imagem do Instagram expira, então é copiada para o bucket biblioteca_thumbnails na pasta do usuário.
import { createClient } from 'npm:@supabase/supabase-js@2.47.10';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const POST_RE = /^https:\/\/(www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reels?|tv)\/[A-Za-z0-9_-]+\/?/i;
const MAX_BYTES = 5 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  // Só usuários logados (o token do usuário define a pasta e as permissões do Storage)
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Não autenticado' }, 401);

  const { url } = await req.json().catch(() => ({ url: '' }));
  if (typeof url !== 'string' || !POST_RE.test(url.trim())) {
    return json({ available: false, message: 'Informe o link de uma publicação do Instagram.' });
  }

  const token = Deno.env.get('META_OEMBED_TOKEN');
  if (!token) {
    return json({ available: false, message: 'Busca automática não configurada (falta o token oEmbed da Meta). Envie a imagem ou cole a URL.' });
  }

  const api = new URL('https://graph.facebook.com/v21.0/instagram_oembed');
  api.searchParams.set('url', url.trim());
  api.searchParams.set('fields', 'thumbnail_url,author_name,title');
  api.searchParams.set('access_token', token);
  const res = await fetch(api, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) {
    return json({ available: false, message: 'O Instagram não liberou a capa desta publicação (pode ser privada ou removida).' });
  }
  const meta = (await res.json()) as { thumbnail_url?: string; author_name?: string; title?: string };
  if (!meta.thumbnail_url) return json({ available: false, message: 'A publicação não tem capa disponível.' });

  // Copia a imagem para o Storage (o endereço do Instagram expira)
  let thumbnailUrl: string | null = null;
  const img = await fetch(meta.thumbnail_url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const type = img?.headers.get('content-type') ?? '';
  if (img?.ok && type.startsWith('image/')) {
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (bytes.byteLength <= MAX_BYTES) {
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from('biblioteca_thumbnails').upload(path, bytes, { contentType: type, cacheControl: '31536000' });
      if (!up.error) thumbnailUrl = supabase.storage.from('biblioteca_thumbnails').getPublicUrl(path).data.publicUrl;
    }
  }
  if (!thumbnailUrl) return json({ available: false, message: 'Não foi possível salvar a capa. Tente enviar a imagem.' });

  return json({
    available: true,
    thumbnail_url: thumbnailUrl,
    profile_name: meta.author_name ?? null,
    title: meta.title ? meta.title.split('\n')[0].slice(0, 120) : null,
  });
});
