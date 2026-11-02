const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const numberFmt = new Intl.NumberFormat('pt-BR');

/** Data "AAAA-MM-DD" (sem fuso) ou timestamp ISO. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

export function formatNumber(n: number | null | undefined): string {
  return numberFmt.format(n ?? 0);
}

export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function displayTitle(title: string | null | undefined): string {
  return title?.trim() ? title : 'Sem título';
}
