// Edge Function: dados e download de um vídeo do Instagram pela API "Instagram Looter" (RapidAPI).
//
// POST { action: "refresh", video_id }  → busca legenda (salva traduzida para o português), autor, data, curtidas e comentários;
//                                          preenche título, perfil, data de publicação e capa quando estão vazios.
// POST { action: "download", video_id } → devolve o arquivo .mp4 do vídeo.
//
// Requer o segredo BIBLIOTECA_RAPIDAPI_KEY (chave do RapidAPI com assinatura da Instagram Looter).
// Usa o login de quem chama: o RLS garante que só vídeos da própria biblioteca são lidos/alterados.
import { createClient } from 'npm:@supabase/supabase-js@2.47.10';
import { isInstagramCdn, parseLooterPost, titleFromCaption, type InstagramInfo, type LooterPost } from '../_shared/looter.ts';
import { translateToPortuguese } from '../_shared/translate.ts';

const HOST = 'instagram-looter2.p.rapidapi.com';
const BUCKET = 'biblioteca_thumbnails';
const MAX_IMAGE = 5 * 1024 * 1024;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-disposition',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function fetchInfo(url: string): Promise<{ info: InstagramInfo | null; error?: string; status?: number }> {
  const key = Deno.env.get('BIBLIOTECA_RAPIDAPI_KEY');
  if (!key) return { info: null, error: 'Chave do RapidAPI não configurada (segredo BIBLIOTECA_RAPIDAPI_KEY).', status: 503 };
  const api = new URL(`https://${HOST}/post-dl`);
  api.searchParams.set('link', url);
  const res = await fetch(api, { headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!res) return { info: null, error: 'O serviço do Instagram não respondeu. Tente novamente.', status: 504 };
  if (res.status === 429) return { info: null, error: 'Limite de consultas do RapidAPI atingido. Aguarde ou aumente o plano.', status: 429 };
  if (res.status === 403) return { info: null, error: 'A chave do RapidAPI não tem assinatura da Instagram Looter.', status: 502 };
  const body = (await res.json().catch(() => null)) as LooterPost | null;
  const info = body ? parseLooterPost(body) : null;
  if (!info) return { info: null, error: 'Não foi possível ler esta publicação (pode ser privada, removida ou de story).', status: 502 };
  return { info };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Não autenticado' }, 401);

  const { action, video_id } = await req.json().catch(() => ({}));
  if (!['refresh', 'download'].includes(action) || typeof video_id !== 'string') return json({ error: 'Pedido inválido' }, 400);

  const { data: video } = await supabase
    .from('biblioteca_videos')
    .select('id, title, instagram_url, profile_name, original_publish_date, thumbnail_url')
    .eq('id', video_id)
    .maybeSingle();
  if (!video) return json({ error: 'Vídeo não encontrado' }, 404);

  const { info, error, status } = await fetchInfo(video.instagram_url);
  if (!info) return json({ error }, status ?? 502);

  // ─── Download: o link do Instagram expira; é buscado na hora e repassado ao navegador ───
  if (action === 'download') {
    if (!isInstagramCdn(info.videoUrl)) return json({ error: 'Esta publicação não tem vídeo para baixar.' }, 404);
    const file = await fetch(info.videoUrl, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
    if (!file?.ok || !file.body) return json({ error: 'O Instagram não liberou o arquivo do vídeo. Tente novamente.' }, 502);
    const name = `${(info.username ?? 'instagram').replace(/[^\w.-]/g, '')}-${video.instagram_url.split('/').filter(Boolean).pop()}.mp4`;
    return new Response(file.body, {
      headers: {
        ...cors,
        'Content-Type': file.headers.get('content-type') ?? 'video/mp4',
        ...(file.headers.get('content-length') ? { 'Content-Length': file.headers.get('content-length')! } : {}),
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    });
  }

  // ─── Atualizar dados: campos do Instagram sempre; os do usuário só quando estão vazios ───
  // Legenda salva em português; a original fica guardada quando houve tradução
  const tr = info.caption ? await translateToPortuguese(info.caption, (u) => fetch(u, { signal: AbortSignal.timeout(15_000) })) : null;
  const caption = tr?.text ?? null;
  const patch: Record<string, unknown> = {
    instagram_caption: caption,
    instagram_caption_original: tr?.translated ? info.caption : null,
    instagram_caption_lang: tr?.lang ?? null,
    instagram_author_name: info.authorName,
    instagram_like_count: info.likeCount,
    instagram_comment_count: info.commentCount,
    instagram_taken_at: info.takenAt,
    instagram_fetched_at: new Date().toISOString(),
  };
  if (!video.title?.trim() && caption) patch.title = titleFromCaption(caption);
  if (!video.profile_name && info.username) patch.profile_name = info.username;
  if (!video.original_publish_date && info.publishDate) patch.original_publish_date = info.publishDate;

  // Capa: copiada para o Storage (o endereço do Instagram expira)
  if (!video.thumbnail_url && isInstagramCdn(info.imageUrl)) {
    const img = await fetch(info.imageUrl, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    const type = img?.headers.get('content-type') ?? '';
    if (img?.ok && type.startsWith('image/')) {
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (bytes.byteLength <= MAX_IMAGE) {
        const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
        const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: type, cacheControl: '31536000' });
        if (!up.error) patch.thumbnail_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
    }
  }

  const { error: upErr } = await supabase.from('biblioteca_videos').update(patch).eq('id', video.id);
  if (upErr) return json({ error: 'Não foi possível salvar os dados do Instagram.' }, 500);
  return json({ ok: true, updated: Object.keys(patch) });
});
