import { Play } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
        <Play className="h-4 w-4 fill-white text-white" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Instagram Video</span>
          <span className="block text-xs text-muted-foreground">Library</span>
        </span>
      )}
    </span>
  );
}
