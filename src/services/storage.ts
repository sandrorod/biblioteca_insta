import { supabase, THUMBNAIL_BUCKET } from '@/integrations/supabase/client';

const MAX_SIDE = 900;

/** Reduz a imagem (lado maior até 900px, WebP) antes de enviar: miniaturas leves para a galeria. */
async function optimize(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82));
  return blob ?? file;
}

/** Envia a capa para a pasta do usuário e devolve o endereço público. */
export async function uploadThumbnail(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Imagem muito grande (máximo 15 MB).');
  const blob = await optimize(file);
  const ext = blob.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(path, blob, { contentType: blob.type || file.type, cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path).data.publicUrl;
}

export interface InstagramMeta {
  available: boolean;
  thumbnail_url?: string | null;
  title?: string | null;
  profile_name?: string | null;
  message?: string;
}

/**
 * Busca capa/autor pela API oficial (oEmbed da Meta) numa Edge Function.
 * Só funciona quando o token da Meta estiver configurado no Supabase; caso contrário volta available=false.
 */
export async function fetchInstagramMeta(url: string): Promise<InstagramMeta> {
  const { data, error } = await supabase.functions.invoke('biblioteca_instagram_oembed', { body: { url } });
  if (error) return { available: false, message: 'Busca automática indisponível no momento.' };
  return data as InstagramMeta;
}
