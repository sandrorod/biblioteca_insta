import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Folder, Hash, Heart, Library, Plus, Video, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, ColorBadge, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { VideoCard } from '@/components/videos/VideoCard';
import { useVideoEditor } from '@/components/videos/VideoEditor';
import { useVideoActions } from '@/hooks/useVideoActions';
import { getDashboard } from '@/services/dashboard';
import { listVideos } from '@/services/videos';
import { formatNumber } from '@/utils/format';

function Stat({ icon: Icon, label, value, to, accent }: { icon: LucideIcon; label: string; value?: number; to: string; accent: string }) {
  return (
    <Link to={to} className="group min-w-0">
      {/* No celular os 5 cards cabem numa linha: mais estreitos, sem o ícone */}
      <Card className="px-1.5 py-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-4">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[9px] font-medium tracking-tight text-muted-foreground sm:text-xs sm:tracking-normal">{label}</span>
          <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md sm:flex" style={{ backgroundColor: `${accent}1a`, color: accent }}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-1 text-lg font-semibold tracking-tight sm:mt-3 sm:text-2xl">{value === undefined ? <Skeleton className="h-6 w-8 sm:h-7 sm:w-14" /> : formatNumber(value)}</div>
      </Card>
    </Link>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const editor = useVideoEditor();
  const { toggleFavorite } = useVideoActions();
  const { data: stats } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  // Recentes: mesma consulta da galeria (chave 'videos' para refletir favoritar/editar na hora)
  const recent = useQuery({ queryKey: ['videos', 'dashboard-recent'], queryFn: () => listVideos({}, 'recent', null, 12) });

  const maxCat = Math.max(1, ...(stats?.top_categories.map((c) => c.video_count) ?? [1]));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={stats ? `${formatNumber(stats.added_last_7_days)} vídeo(s) adicionado(s) nos últimos 7 dias` : 'Visão geral da sua biblioteca'}
        actions={
          // No celular o "+" da barra superior já adiciona vídeos
          <Button variant="brand" className="hidden sm:inline-flex" onClick={() => editor.openCreate('quick')}>
            <Plus /> Adicionar vídeo
          </Button>
        }
      />

      <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
        <Stat icon={Video} label="Vídeos" value={stats?.videos} to="/videos" accent="#ec4899" />
        <Stat icon={Folder} label="Categorias" value={stats?.categories} to="/categorias" accent="#6366f1" />
        <Stat icon={Hash} label="Etiquetas" value={stats?.tags} to="/etiquetas" accent="#0ea5e9" />
        <Stat icon={Heart} label="Favoritos" value={stats?.favorites} to="/favoritos" accent="#f43f5e" />
        <Stat icon={Library} label="Coleções" value={stats?.collections} to="/colecoes" accent="#f59e0b" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Adicionados recentemente</h2>
            <Link to="/videos" className="flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.isLoading ? (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-sm" />
              ))}
            </div>
          ) : recent.data?.length ? (
            <div className="grid grid-cols-3 gap-0.5 sm:gap-1 xl:grid-cols-4">
              {recent.data.map((v) => (
                <VideoCard key={v.id} video={v} onOpen={(id) => navigate(`/videos?video=${id}`)} onToggleFavorite={toggleFavorite} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Video}
              title="Sua biblioteca está vazia"
              description="Cole o link de um vídeo do Instagram para começar."
              action={
                <Button variant="brand" onClick={() => editor.openCreate('quick')}>
                  <Plus /> Adicionar primeiro vídeo
                </Button>
              }
            />
          )}
        </section>

        <aside className="space-y-6">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Categorias mais usadas</h2>
            {stats?.top_categories.length ? (
              <ul className="space-y-2.5">
                {stats.top_categories.map((c) => (
                  <li key={c.id}>
                    <Link to={`/videos?category_id=${c.id}`} className="group block">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate group-hover:underline">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.video_count}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full" style={{ width: `${(c.video_count / maxCat) * 100}%`, backgroundColor: c.color }} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum vídeo categorizado ainda.</p>
            )}
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Etiquetas mais usadas</h2>
            {stats?.top_tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {stats.top_tags.map((t) => (
                  <Link key={t.id} to={`/videos?tags=${t.id}`}>
                    <ColorBadge name={`#${t.name} · ${t.video_count}`} color={t.color} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma etiqueta em uso ainda.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
