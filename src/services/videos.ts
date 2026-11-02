import { supabase } from '@/integrations/supabase/client';
import type { SortOption, Video, VideoFilters, VideoInput } from '@/types';
import { cleanFilters } from '@/utils/filters';
import { instagramKey, normalizeInstagramUrl } from '@/utils/instagram';
import { unwrap } from './errors';

export const PAGE_SIZE = 24;

export interface VideoCursor {
  v: string;
  id: string;
}

/** Uma página da galeria (paginação por cursor, filtros aplicados no banco). */
export async function listVideos(filters: VideoFilters, sort: SortOption, cursor: VideoCursor | null, limit = PAGE_SIZE): Promise<Video[]> {
  const res = await supabase.rpc('biblioteca_list_videos', {
    p_filters: cleanFilters(filters),
    p_sort: sort,
    p_cursor: cursor,
    p_limit: limit,
  });
  return unwrap(res) as Video[];
}

export async function countVideos(filters: VideoFilters): Promise<number> {
  const res = await supabase.rpc('biblioteca_count_videos', { p_filters: cleanFilters(filters) });
  return Number(unwrap(res) ?? 0);
}

export function cursorOf(video: Video): VideoCursor {
  return { v: video.sort_key, id: video.id };
}

/** Vídeo já cadastrado com a mesma publicação (mesma regra de chave do banco). */
export async function findDuplicate(url: string, ignoreId?: string): Promise<{ id: string; title: string } | null> {
  const key = instagramKey(url);
  let q = supabase.from('biblioteca_videos').select('id, title').eq('instagram_key', key).limit(1);
  if (ignoreId) q = q.neq('id', ignoreId);
  const rows = unwrap(await q) as { id: string; title: string }[];
  return rows[0] ?? null;
}

export async function getVideo(id: string): Promise<Video | null> {
  // Reaproveita a RPC da galeria para trazer categoria e etiquetas no mesmo formato
  const res = await supabase
    .from('biblioteca_videos')
    .select('*, category:biblioteca_categories(id, name, color), video_tags:biblioteca_video_tags(tag:biblioteca_tags(id, name, color))')
    .eq('id', id)
    .maybeSingle();
  const row = unwrap(res) as (Omit<Video, 'tags' | 'sort_key'> & { video_tags: { tag: Video['tags'][number] }[] }) | null;
  if (!row) return null;
  const { video_tags, ...rest } = row;
  return { ...rest, tags: video_tags.map((vt) => vt.tag).sort((a, b) => a.name.localeCompare(b.name)), sort_key: '' };
}

export async function createVideo(input: VideoInput, tagIds: string[] = []): Promise<string> {
  const row = unwrap(
    await supabase
      .from('biblioteca_videos')
      .insert({ ...input, instagram_url: normalizeInstagramUrl(input.instagram_url) })
      .select('id')
      .single(),
  ) as { id: string };
  if (tagIds.length) await setVideoTags(row.id, tagIds);
  return row.id;
}

export async function updateVideo(id: string, input: Partial<VideoInput>, tagIds?: string[]): Promise<void> {
  const patch = input.instagram_url ? { ...input, instagram_url: normalizeInstagramUrl(input.instagram_url) } : input;
  unwrap(await supabase.from('biblioteca_videos').update(patch).eq('id', id));
  if (tagIds) await setVideoTags(id, tagIds);
}

export async function setVideoTags(videoId: string, tagIds: string[]): Promise<void> {
  unwrap(await supabase.rpc('biblioteca_set_video_tags', { p_video_id: videoId, p_tag_ids: tagIds }));
}

export async function setFavorite(id: string, value: boolean): Promise<void> {
  unwrap(await supabase.from('biblioteca_videos').update({ is_favorite: value }).eq('id', id));
}

export async function setArchived(id: string, value: boolean): Promise<void> {
  unwrap(await supabase.from('biblioteca_videos').update({ is_archived: value }).eq('id', id));
}

export async function deleteVideo(id: string): Promise<void> {
  unwrap(await supabase.from('biblioteca_videos').delete().eq('id', id));
}
