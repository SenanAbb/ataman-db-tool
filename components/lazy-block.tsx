'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import type { ActionResult } from '@/app/actions/queries';
import { InfoTooltip } from '@/components/info-tooltip';

interface Props<T> {
  title: string;
  description?: string;
  tooltip?: string;
  loader: () => Promise<ActionResult<T>>;
  render: (data: T, meta: { elapsed_ms: number; reload: () => void }) => ReactNode;
  initialAutoLoad?: boolean;
}

export function LazyBlock<T>({
  title,
  description,
  tooltip,
  loader,
  render,
  initialAutoLoad = false,
}: Props<T>) {
  const [data, setData] = useState<T | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const autoStartedRef = useRef(false);

  function run() {
    startTransition(async () => {
      setError(null);
      const result = await loader();
      setElapsed(result.elapsed_ms);
      if (result.error) {
        setError(result.error);
        setData(null);
      } else if (result.data !== undefined) {
        setData(result.data);
      }
    });
  }

  useEffect(() => {
    if (initialAutoLoad && !autoStartedRef.current) {
      autoStartedRef.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground/90">{title}</h3>
            {tooltip ? <InfoTooltip text={tooltip} /> : null}
          </div>
          {description ? (
            <p className="mt-0.5 text-xs text-foreground/60">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {elapsed !== null && data !== null ? (
            <span className="text-xs text-foreground/60">{elapsed} ms</span>
          ) : null}
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="rounded-md border border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Cargando…' : data === null && error === null ? 'Cargar' : 'Recargar'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {pending && data === null && error === null ? (
          <p className="text-xs text-foreground/60">Ejecutando consulta…</p>
        ) : null}
        {error ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {data !== null ? render(data, { elapsed_ms: elapsed ?? 0, reload: run }) : null}
        {data === null && !pending && error === null ? (
          <p className="text-xs text-foreground/60">Aún no cargado. Pulsa Cargar para ejecutar la consulta.</p>
        ) : null}
      </div>
    </div>
  );
}
