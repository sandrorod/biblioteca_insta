import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, PageHeader } from '@/components/ui/misc';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/utils/format';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('As senhas não conferem.');
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(error.message);
    setPassword('');
    setConfirm('');
    toast.success('Senha alterada.');
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Configurações" />
      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="font-semibold">Conta</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="font-medium">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Membro desde</dt>
              <dd className="font-medium">{formatDate(user?.created_at)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4" /> Alterar senha
          </h2>
          <form onSubmit={changePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nova senha" htmlFor="s-pass">
              <Input id="s-pass" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <Field label="Confirmar" htmlFor="s-confirm">
              <Input id="s-confirm" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" loading={saving}>
                Salvar nova senha
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" /> Privacidade
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua biblioteca é particular: vídeos, comentários, etiquetas e coleções só são acessíveis pela sua conta (protegidos por regras de segurança no banco).
            As capas enviadas ficam num armazenamento com endereços aleatórios.
          </p>
        </Card>

        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut /> Sair da conta
        </Button>
      </div>
    </div>
  );
}
