import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** true quando o usuário chegou pelo link de "esqueci a senha" */
  recovering: boolean;
  /** Cadastro em andamento: a tela de cadastro não redireciona sozinha (ela leva ao login) */
  signingUp: boolean;
  setSigningUp: (v: boolean) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  // Troca de usuário (ou saída): descarta os dados em cache da sessão anterior
  useEffect(() => {
    queryClient.clear();
  }, [userId, queryClient]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recovering,
      signingUp,
      setSigningUp,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, recovering, signingUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
