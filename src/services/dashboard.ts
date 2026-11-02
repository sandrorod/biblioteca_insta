import { supabase } from '@/integrations/supabase/client';
import type { DashboardStats } from '@/types';
import { unwrap } from './errors';

export async function getDashboard(): Promise<DashboardStats> {
  return unwrap(await supabase.rpc('biblioteca_dashboard')) as DashboardStats;
}
