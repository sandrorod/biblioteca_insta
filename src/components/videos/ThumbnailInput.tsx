import { ImagePlus, Link2, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { friendlyError } from '@/services/errors';
import { fetchInstagramMeta, uploadThumbnail, type InstagramMeta } from '@/services/storage';
import { PLACEHOLDER } from './VideoCard';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  instagramUrl: string;
  /** Dados extras obtidos na busca automática (título/perfil), para preencher campos vazios */
  onMeta?: (meta: InstagramMeta) => void;
}

/** Capa do vídeo: upload (otimizado), URL de imagem ou busca automática pela API oficial (quando configurada). */
export function ThumbnailInput({ value, onChange, instagramUrl, onMeta }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'auto' | null>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlText, setUrlText] = useState('');
  const [broken, setBroken] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file || !user) return;
    setBusy('upload');
    try {
      onChange(await uploadThumbnail(file, user.id));
      setBroken(false);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const auto = async () => {
    setBusy('auto');
    try {
      const meta = await fetchInstagramMeta(instagramUrl);
      if (!meta.available || !meta.thumbnail_url) {
        toast.info(meta.message ?? 'Não foi possível obter a capa automaticamente. Envie uma imagem ou cole a URL.');
        return;
      }
      onChange(meta.thumbnail_url);
      setBroken(false);
      onMeta?.(meta);
      toast.success('Capa obtida do Instagram.');
    } finally {
      setBusy(null);
    }
  };

  const applyUrl = () => {
    try {
      const u = new URL(urlText.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
      onChange(u.toString());
      setBroken(false);
      setUrlMode(false);
      setUrlText('');
    } catch {
      toast.error('URL de imagem inválida.');
    }
  };

  return (
    <div className="flex gap-3">
      <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-md border bg-zinc-100">
        <img src={!value || broken ? PLACEHOLDER : value} onError={() => setBroken(true)} alt="Capa" className="h-full w-full object-cover" />
        {busy === 'upload' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            <ImagePlus /> Enviar imagem
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setUrlMode((v) => !v)} disabled={!!busy}>
            <Link2 /> URL
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={auto} disabled={!!busy || !instagramUrl} loading={busy === 'auto'}>
            {busy !== 'auto' && <Sparkles />} Automática
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={!!busy} aria-label="Remover capa">
              <Trash2 />
            </Button>
          )}
        </div>
        {urlMode && (
          <div className="flex gap-1.5">
            <Input value={urlText} onChange={(e) => setUrlText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyUrl())} placeholder="https://…/imagem.jpg" className="h-8" autoFocus />
            <Button type="button" size="sm" onClick={applyUrl}>
              Usar
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Sem capa, a galeria mostra uma imagem padrão. Imagens enviadas são reduzidas automaticamente.</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
    </div>
  );
}
