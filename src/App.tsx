import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { GuestRoute, ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ConfirmProvider } from '@/components/ui/confirm';
import { VideoEditorProvider } from '@/components/videos/VideoEditor';
import { AuthProvider } from '@/contexts/AuthContext';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from '@/pages/AuthPages';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { CollectionDetailPage, CollectionsPage } from '@/pages/CollectionsPages';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TagsPage } from '@/pages/TagsPage';
import { AllVideosPage, ArchivedPage, FavoritesPage } from '@/pages/VideosPages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ConfirmProvider>
            <Routes>
              <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
              <Route path="/cadastro" element={<GuestRoute><SignupPage /></GuestRoute>} />
              <Route path="/esqueci-senha" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
              <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <VideoEditorProvider>
                      <AppLayout />
                    </VideoEditorProvider>
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="videos" element={<AllVideosPage />} />
                <Route path="favoritos" element={<FavoritesPage />} />
                <Route path="arquivados" element={<ArchivedPage />} />
                <Route path="categorias" element={<CategoriesPage />} />
                <Route path="etiquetas" element={<TagsPage />} />
                <Route path="colecoes" element={<CollectionsPage />} />
                <Route path="colecoes/:id" element={<CollectionDetailPage />} />
                <Route path="configuracoes" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </ConfirmProvider>
        </BrowserRouter>
        <Toaster position="bottom-center" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
