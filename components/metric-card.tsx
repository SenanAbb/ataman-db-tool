interface Props {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'accent' | 'destructive' | 'warning' | 'info' | 'success';
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-foreground',
  accent: 'text-accent',
  destructive: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
  success: 'text-success',
};

export function MetricCard({ label, value, sub, tone = 'default' }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-foreground/60">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold ${TONE[tone]}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-foreground/60">{sub}</p> : null}
    </div>
  );
}
