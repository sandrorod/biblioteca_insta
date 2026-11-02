import { supabase } from '@/integrations/supabase/client';
import type { Category, Collection, Tag } from '@/types';
import { unwrap } from './errors';

// ─── Categorias ─────────────────────────────────────────────────────────────
export async function listCategories(): Promise<Category[]> {
  return unwrap(await supabase.from('biblioteca_categories_stats').select('*').order('position').order('created_at')) as Category[];
}

export async function saveCategory(data: { id?: string; name: string; description: string | null; color: string; position?: number }) {
  const { id, ...fields } = data;
  if (id) return unwrap(await supabase.from('biblioteca_categories').update(fields).eq('id', id));
  return unwrap(await supabase.from('biblioteca_categories').insert(fields));
}

export async function deleteCategory(id: string, transferTo: string | null) {
  return unwrap(await supabase.rpc('biblioteca_delete_category', { p_id: id, p_transfer_to: transferTo }));
}

export async function reorderCategories(ids: string[]) {
  return unwrap(await supabase.rpc('biblioteca_reorder_categories', { p_ids: ids }));
}

// ─── Etiquetas ──────────────────────────────────────────────────────────────
export async function listTags(): Promise<Tag[]> {
  return unwrap(await supabase.from('biblioteca_tags_stats').select('*').order('name')) as Tag[];
}

export async function createTag(name: string, color: string): Promise<Tag> {
  const row = unwrap(await supabase.from('biblioteca_tags').insert({ name: name.trim(), color }).select('*').single()) as Omit<Tag, 'video_count'>;
  return { ...row, video_count: 0 };
}

export async function updateTag(id: string, fields: { name: string; color: string }) {
  return unwrap(await supabase.from('biblioteca_tags').update({ ...fields, name: fields.name.trim() }).eq('id', id));
}

export async function deleteTag(id: string) {
  return unwrap(await supabase.from('biblioteca_tags').delete().eq('id', id));
}

// ─── Coleções ───────────────────────────────────────────────────────────────
export async function listCollections(): Promise<Collection[]> {
  return unwrap(await supabase.from('biblioteca_collections_stats').select('*').order('updated_at', { ascending: false })) as Collection[];
}

export async function getCollection(id: string): Promise<Collection | null> {
  return unwrap(await supabase.from('biblioteca_collections_stats').select('*').eq('id', id).maybeSingle()) as Collection | null;
}

export async function saveCollection(data: { id?: string; name: string; description: string | null; color: string; cover_url: string | null }) {
  const { id, ...fields } = data;
  if (id) return unwrap(await supabase.from('biblioteca_collections').update(fields).eq('id', id));
  return unwrap(await supabase.from('biblioteca_collections').insert(fields));
}

export async function deleteCollection(id: string) {
  return unwrap(await supabase.from('biblioteca_collections').delete().eq('id', id));
}

/** Coleções em que o vídeo está. */
export async function collectionsOfVideo(videoId: string): Promise<string[]> {
  const rows = unwrap(await supabase.from('biblioteca_collection_videos').select('collection_id').eq('video_id', videoId)) as { collection_id: string }[];
  return rows.map((r) => r.collection_id);
}

export async function setVideoInCollection(collectionId: string, videoId: string, inside: boolean) {
  if (inside) {
    return unwrap(
      await supabase.from('biblioteca_collection_videos').upsert({ collection_id: collectionId, video_id: videoId }, { onConflict: 'collection_id,video_id', ignoreDuplicates: true }),
    );
  }
  return unwrap(await supabase.from('biblioteca_collection_videos').delete().eq('collection_id', collectionId).eq('video_id', videoId));
}

// ─── Perfis de origem ───────────────────────────────────────────────────────
export async function searchProfiles(term: string, limit = 8): Promise<string[]> {
  let q = supabase.from('biblioteca_profiles').select('name').order('name').limit(limit);
  if (term.trim()) q = q.ilike('name', `%${term.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const rows = unwrap(await q) as { name: string }[];
  return rows.map((r) => r.name);
}
