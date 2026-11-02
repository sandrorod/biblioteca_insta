import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { addComment, deleteComment, listComments, updateComment } from '@/services/comments';
import { friendlyError } from '@/services/errors';
import { formatDateTime } from '@/utils/format';

/** Comentários do vídeo (ideias, referências). Carregados só quando o vídeo é aberto. */
export function CommentsPanel({ videoId, onChanged }: { videoId: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: comments, isLoading } = useQuery({ queryKey: ['comments', videoId], queryFn: () => listComments(videoId) });
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const reload = async () => {
    await qc.invalidateQueries({ queryKey: ['comments', videoId] });
    onChanged();
  };

  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await addComment(videoId, text);
      setText('');
      await reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing?.text.trim()) return;
    try {
      await updateComment(editing.id, editing.text);
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: 'Excluir comentário?', confirmLabel: 'Excluir', destructive: true }))) return;
    try {
      await deleteComment(id);
      await reload();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> Comentários {comments?.length ? `(${comments.length})` : ''}
      </h3>
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && void add()}
          placeholder="Uma ideia, referência ou observação…"
          rows={2}
          maxLength={5000}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={add} loading={saving} disabled={!text.trim()}>
            Comentar
          </Button>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {isLoading && <Skeleton className="h-14" />}
        {comments?.map((c) => (
          <li key={c.id} className="group rounded-lg border bg-zinc-50/60 p-3">
            {editing?.id === c.id ? (
              <div className="space-y-2">
                <Textarea value={editing.text} onChange={(e) => setEditing({ id: c.id, text: e.target.value })} rows={3} autoFocus maxLength={5000} />
                <div className="flex justify-end gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancelar">
                    <X />
                  </Button>
                  <Button size="icon-sm" onClick={saveEdit} aria-label="Salvar">
                    <Check />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words text-sm">{c.content}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(c.created_at)}
                    {c.updated_at !== c.created_at && new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 1000 && ' · editado'}
                  </span>
                  <span className="flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <button type="button" onClick={() => setEditing({ id: c.id, text: c.content })} className="rounded p-1 text-zinc-400 hover:bg-white hover:text-zinc-800" aria-label="Editar comentário">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(c.id)} className="rounded p-1 text-zinc-400 hover:bg-white hover:text-red-600" aria-label="Excluir comentário">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
