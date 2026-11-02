import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseConfigured } from '@/integrations/supabase/client';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {!supabaseConfigured && (
            <p className="mt-4 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900">
              Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.
            </p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

const authMessage = (msg: string) => {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Este e-mail já tem cadastro. Faça login.';
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link enviado antes de entrar.';
  return msg;
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; email?: string } | null;
  const from = state?.from ?? '/';
  const [email, setEmail] = useState(state?.email ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return toast.error(authMessage(error.message));
    navigate(from, { replace: true });
  };

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse sua biblioteca de vídeos."
      footer={
        <>
          Não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-zinc-900 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!state?.email} />
        </Field>
        <Field label="Senha" htmlFor="password">
          <Input id="password" type="password" autoFocus={!!state?.email} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <div className="flex justify-end">
          <Link to="/esqueci-senha" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const { setSigningUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('As senhas não conferem.');
    setLoading(true);
    setSigningUp(true);
    const address = email.trim();
    const { data, error } = await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: `${window.location.origin}/` } });
    if (error && /already registered/i.test(error.message)) {
      setLoading(false);
      setSigningUp(false);
      toast.info('Este e-mail já tem uma conta. Entre com a senha dela.', {
        description: 'Se não lembrar a senha, use “Esqueci minha senha”.',
      });
      return navigate('/login', { replace: true, state: { email: address } });
    }
    if (error) {
      setLoading(false);
      setSigningUp(false);
      return toast.error(authMessage(error.message));
    }
    // Precisa confirmar o e-mail antes de entrar
    if (!data.session) {
      setLoading(false);
      setSigningUp(false);
      return setSent(true);
    }
    // Cadastro concluído: a pessoa entra pela tela de login
    await supabase.auth.signOut();
    setLoading(false);
    toast.success('Cadastro realizado! Faça login para acessar sua biblioteca.');
    navigate('/login', { replace: true, state: { email: address } });
    setSigningUp(false);
  };

  if (sent) {
    return (
      <AuthShell title="Confirme seu e-mail" subtitle={`Enviamos um link de confirmação para ${email}.`} footer={<Link to="/login" className="font-medium text-zinc-900 hover:underline">Voltar ao login</Link>}>
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Cada conta tem sua própria biblioteca, visível só para você."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-zinc-900 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Senha" htmlFor="password" hint="Mínimo de 6 caracteres.">
          <Input id="password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/redefinir-senha` });
    setLoading(false);
    if (error) return toast.error(authMessage(error.message));
    setSent(true);
  };

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle={sent ? 'Se o e-mail tiver cadastro, você receberá um link para criar uma nova senha.' : 'Informe seu e-mail para receber o link de recuperação.'}
      footer={
        <Link to="/login" className="font-medium text-zinc-900 hover:underline">
          Voltar ao login
        </Link>
      }
    >
      {sent ? (
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="E-mail" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('As senhas não conferem.');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(authMessage(error.message));
    toast.success('Senha alterada.');
    navigate('/', { replace: true });
  };

  return (
    <AuthShell title="Nova senha" subtitle="Defina a nova senha da sua conta.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nova senha" htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Salvar nova senha
        </Button>
      </form>
    </AuthShell>
  );
}
