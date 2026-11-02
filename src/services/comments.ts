import { supabase } from '@/integrations/supabase/client';
import type { Comment } from '@/types';
import { unwrap } from './errors';

/** Comentários de um vídeo (carregados só quando o vídeo é aberto). */
export async function listComments(videoId: string): Promise<Comment[]> {
  return unwrap(
    await supabase.from('biblioteca_comments').select('id, video_id, content, created_at, updated_at').eq('video_id', videoId).order('created_at', { ascending: false }),
  ) as Comment[];
}

export async function addComment(videoId: string, content: string) {
  return unwrap(await supabase.from('biblioteca_comments').insert({ video_id: videoId, content: content.trim() }));
}

export async function updateComment(id: string, content: string) {
  return unwrap(await supabase.from('biblioteca_comments').update({ content: content.trim() }).eq('id', id));
}

export async function deleteComment(id: string) {
  return unwrap(await supabase.from('biblioteca_comments').delete().eq('id', id));
}
