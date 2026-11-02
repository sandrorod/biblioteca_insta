import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from './button';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Confirmação antes de ações irreversíveis: `if (await confirm({...})) ...` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-zinc-950/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:zoom-in-95">
            <AlertDialog.Title className="text-lg font-semibold">{opts?.title}</AlertDialog.Title>
            {opts?.description && <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">{opts.description}</AlertDialog.Description>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Cancel asChild>
                <Button variant="outline">Cancelar</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant={opts?.destructive ? 'destructive' : 'default'} onClick={() => close(true)}>
                  {opts?.confirmLabel ?? 'Confirmar'}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>');
  return ctx;
}
