import { supabase } from '@/integrations/supabase/client';

const FUNCTION = 'biblioteca_instagram_info';

async function call(action: 'refresh' | 'download', videoId: string): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ action, video_id: videoId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Não foi possível falar com o Instagram. Tente novamente.');
  }
  return res;
}

/** Busca legenda, autor, data, curtidas e comentários no Instagram e grava no vídeo (preenche campos vazios). */
export async function refreshInstagramInfo(videoId: string): Promise<void> {
  await call('refresh', videoId);
}

/** Baixa o arquivo .mp4 do vídeo para o computador/celular. */
export async function downloadVideo(videoId: string): Promise<void> {
  const res = await call('download', videoId);
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'video-instagram.mp4';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
