import { AlertTriangle, Link2, Zap } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useDebounce } from '@/hooks/useDebounce';
import { useCategories, useRefreshLibrary } from '@/hooks/useTaxonomy';
import { friendlyError } from '@/services/errors';
import { createVideo, findDuplicate, updateVideo } from '@/services/videos';
import type { Video, VideoInput } from '@/types';
import { cn } from '@/utils/cn';
import { isInstagramUrl, profileFromUrl } from '@/utils/instagram';
import { TagPicker } from './TagPicker';
import { ThumbnailInput } from './ThumbnailInput';

interface EditorApi {
  /** Cadastro (rápido: só o link; completo: todos os campos) */
  openCreate: (mode?: 'quick' | 'full') => void;
  openEdit: (video: Video) => void;
}

const EditorContext = createContext<EditorApi | null>(null);

export function useVideoEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useVideoEditor precisa estar dentro de <VideoEditorProvider>');
  return ctx;
}

type State = { kind: 'closed' } | { kind: 'create'; mode: 'quick' | 'full' } | { kind: 'edit'; video: Video };

/** Disponibiliza o cadastro/edição de vídeos em qualquer página. */
export function VideoEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'closed' });
  const api: EditorApi = {
    openCreate: (mode = 'quick') => setState({ kind: 'create', mode }),
    openEdit: (video) => setState({ kind: 'edit', video }),
  };
  const close = () => setState({ kind: 'closed' });

  return (
    <EditorContext.Provider value={api}>
      {children}
      <Dialog open={state.kind !== 'closed'} onOpenChange={(o) => !o && close()}>
        <DialogContent className={cn(state.kind === 'create' && state.mode === 'quick' ? 'max-w-md' : 'max-w-2xl')}>
          {state.kind === 'create' && state.mode === 'quick' && <QuickAdd onDone={close} onFull={() => setState({ kind: 'create', mode: 'full' })} />}
          {state.kind === 'create' && state.mode === 'full' && <VideoForm onDone={close} />}
          {state.kind === 'edit' && <VideoForm video={state.video} onDone={close} />}
        </DialogContent>
      </Dialog>
    </EditorContext.Provider>
  );
}

/** Aviso de vídeo já cadastrado (verificado enquanto o link é digitado). */
function useDuplicate(url: string, ignoreId?: string) {
  const debounced = useDebounce(url.trim(), 400);
  const [dup, setDup] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!isInstagramUrl(debounced)) {
      setDup(null);
      return;
    }
    findDuplicate(debounced, ignoreId)
      .then((d) => alive && setDup(d))
      .catch(() => alive && setDup(null));
    return () => {
      alive = false;
    };
  }, [debounced, ignoreId]);
  return dup;
}

function DuplicateWarning({ dup, onOpen }: { dup: { id: string; title: string }; onOpen: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Este vídeo já está na biblioteca{dup.title ? ` (“${dup.title}”)` : ''}.{' '}
        <button type="button" onClick={onOpen} className="font-semibold underline underline-offset-2">
          Abrir
        </button>
      </span>
    </div>
  );
}

function QuickAdd({ onDone, onFull }: { onDone: () => void; onFull: () => void }) {
  const refresh = useRefreshLibrary();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const dup = useDuplicate(url);
  const valid = isInstagramUrl(url);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || dup) return;
    setSaving(true);
    try {
      const id = await createVideo({
        instagram_url: url,
        title: '',
        description: null,
        thumbnail_url: null,
        profile_name: profileFromUrl(url),
        category_id: null,
        original_publish_date: null,
        notes: null,
      });
      refresh();
      toast.success('Vídeo salvo. Complete os dados quando quiser.', {
        action: { label: 'Abrir', onClick: () => navigate(`/videos?video=${id}`) },
      });
      setUrl('');
      onDone();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-pink-500" /> Cadastro rápido
        </DialogTitle>
        <DialogDescription>Cole o link do Instagram. Título, categoria e etiquetas podem ser completados depois.</DialogDescription>
      </DialogHeader>
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" className="h-10 pl-9" autoFocus />
      </div>
      {url && !valid && <p className="text-xs text-red-600">Informe um link do Instagram (instagram.com/…).</p>}
      {dup && (
        <DuplicateWarning
          dup={dup}
          onOpen={() => {
            onDone();
            navigate(`/videos?video=${dup.id}`);
          }}
        />
      )}
      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="ghost" onClick={onFull}>
          Cadastro completo
        </Button>
        <Button type="submit" variant="brand" loading={saving} disabled={!valid || !!dup}>
          Salvar vídeo
        </Button>
      </DialogFooter>
    </form>
  );
}

const emptyInput: VideoInput = {
  title: '',
  instagram_url: '',
  description: null,
  thumbnail_url: null,
  profile_name: null,
  category_id: null,
  original_publish_date: null,
  notes: null,
};

function VideoForm({ video, onDone }: { video?: Video; onDone: () => void }) {
  const refresh = useRefreshLibrary();
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const [form, setForm] = useState<VideoInput>(() =>
    video
      ? {
          title: video.title,
          instagram_url: video.instagram_url,
          description: video.description,
          thumbnail_url: video.thumbnail_url,
          profile_name: video.profile_name,
          category_id: video.category_id,
          original_publish_date: video.original_publish_date,
          notes: video.notes,
        }
      : emptyInput,
  );
  const [tagIds, setTagIds] = useState<string[]>(video?.tags.map((t) => t.id) ?? []);
  const [saving, setSaving] = useState(false);
  const dup = useDuplicate(form.instagram_url, video?.id);
  const valid = isInstagramUrl(form.instagram_url);
  const set = <K extends keyof VideoInput>(k: K, v: VideoInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (v: string) => (v.trim() ? v : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || dup) return;
    setSaving(true);
    try {
      const data = { ...form, profile_name: form.profile_name || profileFromUrl(form.instagram_url) };
      if (video) await updateVideo(video.id, data, tagIds);
      else await createVideo(data, tagIds);
      refresh();
      toast.success(video ? 'Alterações salvas.' : 'Vídeo cadastrado.');
      onDone();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>{video ? 'Editar vídeo' : 'Novo vídeo'}</DialogTitle>
        <DialogDescription>{video ? 'Todas as alterações são salvas na sua biblioteca.' : 'Somente o link é obrigatório.'}</DialogDescription>
      </DialogHeader>

      <Field label="URL do Instagram *" htmlFor="v-url">
        <Input id="v-url" value={form.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} placeholder="https://www.instagram.com/reel/…" autoFocus={!video} required />
        {form.instagram_url && !valid && <p className="text-xs text-red-600">Informe um link do Instagram.</p>}
        {dup && (
          <DuplicateWarning
            dup={dup}
            onOpen={() => {
              onDone();
              navigate(`/videos?video=${dup.id}`);
            }}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" htmlFor="v-title" className="sm:col-span-2">
          <Input id="v-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={300} placeholder="Ex.: Transição com corte no beat" />
        </Field>
        <Field label="Perfil de origem" htmlFor="v-profile">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">@</span>
            <Input id="v-profile" value={form.profile_name ?? ''} onChange={(e) => set('profile_name', text(e.target.value.replace(/^@+/, '')))} className="pl-7" maxLength={100} placeholder="perfil" />
          </div>
        </Field>
        <Field label="Data original da publicação" htmlFor="v-date">
          <Input id="v-date" type="date" value={form.original_publish_date ?? ''} onChange={(e) => set('original_publish_date', e.target.value || null)} />
        </Field>
        <Field label="Categoria principal" htmlFor="v-category" className="sm:col-span-2">
          <select
            id="v-category"
            value={form.category_id ?? ''}
            onChange={(e) => set('category_id', e.target.value || null)}
            className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Etiquetas">
        <TagPicker value={tagIds} onChange={setTagIds} />
      </Field>

      <Field label="Descrição" htmlFor="v-desc">
        <Textarea id="v-desc" value={form.description ?? ''} onChange={(e) => set('description', text(e.target.value))} rows={3} maxLength={10000} />
      </Field>

      <Field label="Observações internas" htmlFor="v-notes" hint="Só você vê. Também entram na pesquisa.">
        <Textarea id="v-notes" value={form.notes ?? ''} onChange={(e) => set('notes', text(e.target.value))} rows={2} maxLength={20000} />
      </Field>

      <Field label="Miniatura">
        <ThumbnailInput
          value={form.thumbnail_url}
          onChange={(url) => set('thumbnail_url', url)}
          instagramUrl={valid ? form.instagram_url : ''}
          onMeta={(meta) =>
            setForm((f) => ({
              ...f,
              title: f.title || meta.title || '',
              profile_name: f.profile_name || meta.profile_name || null,
            }))
          }
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="brand" loading={saving} disabled={!valid || !!dup}>
          {video ? 'Salvar alterações' : 'Cadastrar vídeo'}
        </Button>
      </DialogFooter>
    </form>
  );
}
