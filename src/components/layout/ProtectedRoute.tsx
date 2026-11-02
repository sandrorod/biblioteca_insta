import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/** Páginas internas só com login; sem sessão vai para o login e volta depois. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/** Login/cadastro: quem já está logado vai direto para o painel. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, loading, recovering } = useAuth();
  if (loading) return null;
  if (user && !recovering) return <Navigate to="/" replace />;
  return <>{children}</>;
}
