'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';

type Status = 'loading' | 'connected' | 'error';

export function HealthPill() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setStatus(data.status === 'connected' ? 'connected' : 'error');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    check();
    const id = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const styles: Record<Status, string> = {
    loading: 'border-border bg-muted text-foreground/60',
    connected: 'border-success bg-success/10 text-success',
    error: 'border-destructive bg-destructive/10 text-destructive',
  };
  const Icon = status === 'loading' ? LoaderCircle : status === 'connected' ? CircleCheck : CircleX;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
      aria-live="polite"
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
      {status === 'loading' ? 'Comprobando' : status === 'connected' ? 'BD conectada' : 'Error BD'}
    </span>
  );
}
