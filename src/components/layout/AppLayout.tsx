import * as DialogPrimitive from '@radix-ui/react-dialog';
import { LogOut, Menu, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useVideoEditor } from '@/components/videos/VideoEditor';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';
import { NAV } from './nav';

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item && item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900',
              isActive && 'bg-zinc-100 text-zinc-900',
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const editor = useVideoEditor();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <div className="px-3">
        <Button
          variant="brand"
          className="w-full"
          onClick={() => {
            onNavigate?.();
            editor.openCreate('quick');
          }}
        >
          <Plus /> Adicionar vídeo
        </Button>
      </div>
      <div className="mt-5 flex-1 overflow-y-auto px-3">
        <NavItems onNavigate={onNavigate} />
      </div>
      <div className="border-t p-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
            {user?.email?.[0] ?? '?'}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-600">{user?.email}</span>
          <button type="button" onClick={() => void signOut()} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Sair" title="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Estrutura das páginas internas: barra superior com menu hambúrguer (gaveta lateral) em todas as telas. */
export function AppLayout() {
  const [open, setOpen] = useState(false);
  const editor = useVideoEditor();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-dvh">
      {/* Barra superior com menu hambúrguer (em todas as telas) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white/95 px-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-zinc-100" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <NavLink to="/" aria-label="Ir para o Dashboard">
            <Logo compact className="sm:hidden" />
            <Logo className="hidden sm:flex" />
          </NavLink>
        </div>
        <div className="flex items-center gap-2">
          {/* Celular: "Cadastro completo" ao lado do "+", que fica mais grosso e colorido */}
          <button
            type="button"
            onClick={() => editor.openCreate('full')}
            className="rounded-full border px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 sm:hidden"
          >
            Cadastro completo
          </button>
          <button
            type="button"
            onClick={() => editor.openCreate('quick')}
            className="brand-gradient flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm hover:opacity-95 sm:h-auto sm:w-auto sm:rounded-md sm:bg-none sm:p-2 sm:text-zinc-900 sm:shadow-none sm:hover:bg-zinc-100"
            aria-label="Adicionar vídeo"
            title="Adicionar vídeo"
          >
            <Plus className="h-5 w-5 stroke-[3] sm:stroke-2" />
          </button>
        </div>
      </header>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-zinc-950/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-white shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-left" aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
            <DialogPrimitive.Close className="absolute right-3 top-5 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label="Fechar menu">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <main>
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
