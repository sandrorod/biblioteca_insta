import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { PALETTE, softColor } from '@/utils/colors';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-zinc-200/70', className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)} {...props} />;
}

/** Etiqueta/categoria colorida */
export function ColorBadge({ name, color, className, onRemove, style }: { name: string; color: string; className?: string; onRemove?: () => void; style?: CSSProperties }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs font-medium', className)} style={{ ...softColor(color), ...style }}>
      <span className="truncate">{name}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-0.5 rounded-full px-0.5 opacity-70 hover:opacity-100" aria-label={`Remover ${name}`}>
          ×
        </button>
      )}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
        <Icon className="h-5 w-5 text-zinc-500" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn('h-7 w-7 rounded-full border-2 border-white shadow-sm ring-offset-1 transition', value.toLowerCase() === c && 'ring-2 ring-zinc-900')}
          style={{ backgroundColor: c }}
          aria-label={`Cor ${c}`}
        />
      ))}
      <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border text-xs text-zinc-500" title="Outra cor">
        +
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  );
}
