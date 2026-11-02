import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Página não encontrada"
      description="O endereço pode estar errado ou a página foi removida."
      action={
        <Button asChild variant="outline">
          <Link to="/">Ir para o Dashboard</Link>
        </Button>
      }
    />
  );
}
