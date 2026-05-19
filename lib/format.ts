const intFmt = new Intl.NumberFormat('es-ES');

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return intFmt.format(n);
}

export function formatPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(digits)} %`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return d.slice(0, 10);
}
