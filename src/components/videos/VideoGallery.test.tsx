import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmProvider } from '@/components/ui/confirm';
import type { Video } from '@/types';
import { VideoEditorProvider } from './VideoEditor';
import { VideoGallery } from './VideoGallery';

// ─── Banco simulado: 60 vídeos, paginação por cursor como a RPC ─────────────
const all: Video[] = Array.from({ length: 60 }, (_, i) => ({
  id: `id-${String(i).padStart(2, '0')}`,
  title: `Vídeo ${i}`,
  instagram_url: `https://www.instagram.com/p/C${i}/`,
  description: null,
  thumbnail_url: null,
  profile_name: null,
  category_id: null,
  original_publish_date: null,
  notes: null,
  is_favorite: false,
  is_archived: false,
  comments_count: 0,
  created_at: new Date(2024, 0, 60 - i).toISOString(),
  updated_at: new Date(2024, 0, 60 - i).toISOString(),
  instagram_caption: null,
  instagram_author_name: null,
  instagram_like_count: null,
  instagram_comment_count: null,
  instagram_taken_at: null,
  instagram_fetched_at: null,
  category: null,
  tags: [],
  sort_key: String(i),
}));

const listVideos = vi.fn(async (filters: { search?: string }, _sort: string, cursor: { v: string } | null, limit = 24) => {
  const source = filters.search ? all.filter((v) => v.title.includes(filters.search!)) : all;
  const start = cursor ? source.findIndex((v) => v.sort_key === cursor.v) + 1 : 0;
  return source.slice(start, start + limit);
});

vi.mock('@/services/videos', async (orig) => ({
  ...(await orig<typeof import('@/services/videos')>()),
  listVideos: (...args: Parameters<typeof listVideos>) => listVideos(...args),
  countVideos: async (f: { search?: string }) => (f.search ? all.filter((v) => v.title.includes(f.search!)).length : all.length),
}));
vi.mock('@/services/taxonomy', () => ({
  listCategories: async () => [],
  listTags: async () => [],
  listCollections: async () => [],
  searchProfiles: async () => [],
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

// IntersectionObserver controlável: o teste "rola" até o fim acionando o observador do sentinela da galeria
let observerCallback: IntersectionObserverCallback | null = null;
class FakeObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    if (el.getAttribute('data-testid') === 'gallery-sentinel') observerCallback = this.cb;
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}
const scrollToEnd = () => act(() => observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

function setup(initialPath = '/videos') {
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <ConfirmProvider>
          <VideoEditorProvider>
            <VideoGallery />
          </VideoEditorProvider>
        </ConfirmProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cards = () => screen.queryAllByRole('button', { name: /^Abrir Vídeo/ });

beforeEach(() => {
  listVideos.mockClear();
  observerCallback = null;
});

describe('Galeria com carregamento progressivo', () => {
  it('carrega 24 por vez, mantém os anteriores e para no fim', async () => {
    setup();
    await waitFor(() => expect(cards()).toHaveLength(24));
    expect(listVideos).toHaveBeenCalledTimes(1);
    expect(screen.getByText('60 vídeos')).toBeInTheDocument();

    scrollToEnd();
    await waitFor(() => expect(cards()).toHaveLength(48));
    expect(listVideos.mock.calls[1][2]).toEqual({ v: '23', id: 'id-23' }); // cursor = última linha

    scrollToEnd();
    await waitFor(() => expect(cards()).toHaveLength(60));
    expect(await screen.findByText(/Fim da lista/)).toBeInTheDocument();

    // Sem mais páginas: rolar de novo não faz nova requisição
    const calls = listVideos.mock.calls.length;
    scrollToEnd();
    await new Promise((r) => setTimeout(r, 50));
    expect(listVideos.mock.calls.length).toBe(calls);
    expect(new Set(cards().map((c) => c.getAttribute('aria-label'))).size).toBe(60); // sem duplicados
  });

  it('não dispara requisições simultâneas', async () => {
    setup();
    await waitFor(() => expect(cards()).toHaveLength(24));
    scrollToEnd();
    scrollToEnd();
    scrollToEnd();
    await waitFor(() => expect(cards()).toHaveLength(48));
    expect(listVideos).toHaveBeenCalledTimes(2);
  });

  it('pesquisa consulta o banco e recomeça do primeiro lote', async () => {
    setup();
    await waitFor(() => expect(cards()).toHaveLength(24));
    fireEvent.change(screen.getByRole('textbox', { name: 'Pesquisar vídeos' }), { target: { value: 'Vídeo 5' } });
    // "Vídeo 5" e "Vídeo 50"…"Vídeo 59": 11 resultados, inclusive vídeos que ainda não estavam na tela
    await waitFor(() => expect(cards()).toHaveLength(11), { timeout: 2000 });
    const last = listVideos.mock.calls[listVideos.mock.calls.length - 1];
    expect(last[0]).toMatchObject({ search: 'Vídeo 5' });
    expect(last[2]).toBeNull();
    expect(screen.getByText('11 resultados')).toBeInTheDocument();
  });

  it('mostra erro com botão de tentar novamente', async () => {
    listVideos.mockRejectedValueOnce(new Error('falha de rede'));
    setup();
    expect(await screen.findByText(/Não foi possível carregar os vídeos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    await waitFor(() => expect(cards()).toHaveLength(24));
  });
});
