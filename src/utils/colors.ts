export const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#64748b', '#78716c', '#18181b',
];

export function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

/** Fundo suave + texto legível a partir da cor da etiqueta/categoria. */
export function softColor(hex: string): { backgroundColor: string; color: string; borderColor: string } {
  return { backgroundColor: `${hex}14`, color: hex, borderColor: `${hex}33` };
}
