import type { PostgrestError } from '@supabase/supabase-js';

/** Mensagem amigável para erros do Supabase/Postgres. */
export function friendlyError(err: unknown): string {
  const e = err as Partial<PostgrestError> & { message?: string };
  if (e?.code === '23505') {
    if (e.message?.includes('biblioteca_videos_user_key')) return 'Este vídeo já está na sua biblioteca.';
    return 'Já existe um item com esse nome.';
  }
  if (e?.code === '23514') return 'Algum campo está fora do formato ou do tamanho permitido.';
  if (e?.code === '42501') return 'Você não tem permissão para esta ação.';
  if (e?.message === 'Failed to fetch') return 'Sem conexão com o servidor. Verifique sua internet.';
  return e?.message || 'Algo deu errado. Tente novamente.';
}

export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
