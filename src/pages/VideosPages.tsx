import { Archive, Heart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { VideoGallery } from '@/components/videos/VideoGallery';
import { useVideoEditor } from '@/components/videos/VideoEditor';
import type { VideoFilters } from '@/types';

const FAVORITES: VideoFilters = { favorites: true };
const ARCHIVED: VideoFilters = { archived: true };

export function AllVideosPage() {
  const editor = useVideoEditor();
  return (
    <>
      <PageHeader
        title="Todos os vídeos"
        actions={
          <>
            <Button variant="outline" onClick={() => editor.openCreate('full')}>
              Cadastro completo
            </Button>
            <Button variant="brand" className="hidden sm:inline-flex" onClick={() => editor.openCreate('quick')}>
              <Plus /> Adicionar vídeo
            </Button>
          </>
        }
      />
      <VideoGallery />
    </>
  );
}

export function FavoritesPage() {
  return (
    <>
      <PageHeader title="Favoritos" description="Vídeos marcados com o coração." />
      <VideoGallery base={FAVORITES} locked={['favorites']} emptyState={<EmptyState icon={Heart} title="Nenhum favorito ainda" description="Toque no coração de um vídeo para guardá-lo aqui." />} />
    </>
  );
}

export function ArchivedPage() {
  return (
    <>
      <PageHeader title="Arquivados" description="Vídeos fora da galeria principal. Abra um vídeo e use “Restaurar” para trazê-lo de volta." />
      <VideoGallery base={ARCHIVED} emptyState={<EmptyState icon={Archive} title="Nada arquivado" description="Vídeos arquivados saem da galeria sem serem excluídos." />} />
    </>
  );
}
