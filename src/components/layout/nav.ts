import { Archive, Folder, Hash, Heart, LayoutDashboard, Library, Settings, Video } from 'lucide-react';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/videos', label: 'Todos os vídeos', icon: Video },
  { to: '/categorias', label: 'Categorias', icon: Folder },
  { to: '/etiquetas', label: 'Etiquetas', icon: Hash },
  { to: '/colecoes', label: 'Coleções', icon: Library },
  { to: '/favoritos', label: 'Favoritos', icon: Heart },
  { to: '/arquivados', label: 'Arquivados', icon: Archive },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
] as const;
