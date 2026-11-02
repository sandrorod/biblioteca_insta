import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

/** Cliente único do Supabase. Só usa a chave pública (anon); os dados são protegidos pelo RLS. */
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Bucket das capas (prefixo biblioteca_ porque o projeto Supabase é compartilhado). */
export const THUMBNAIL_BUCKET = 'biblioteca_thumbnails';
