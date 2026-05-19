'use client';

import { useState } from 'react';
import { LazyBlock } from '@/components/lazy-block';
import { MetricCard } from '@/components/metric-card';
import { MetricTable } from '@/components/metric-table';
import { DonutChart } from '@/components/donut-chart';
import {
  loadExecutionStatus,
  loadSeedStatus,
  loadBagaje,
  loadTopChains,
  loadExtremeDates,
} from '@/app/actions/queries';
import { formatInt, formatPct, formatDate } from '@/lib/format';
import type {
  ExecutionStatusRow,
  SeedStatusRow,
  TopChainRow,
  ExtremeDateRow,
} from '@/lib/types';

export function ExecutionStatusBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Estado de ejecución de records"
      description="Ejecutados vs pendientes (pasados, hoy, futuros)."
      tooltip="Clasifica los records según startDate y originalScheduledDate. Indicador clave del uso real de la app por el cliente: alto % ejecutados = el cliente cierra sus visitas con normalidad; alto % pendientes pasados = visitas vencidas no ejecutadas (uso bajo o backlog); alto % pendientes futuros = proyecciones al futuro (siembra histórica)."
      initialAutoLoad
      loader={() => loadExecutionStatus(tenant)}
      render={(rows) => {
        const by = (label: string) => rows.find((r) => r.category.startsWith(label));
        const executed = by('a)');
        const past = by('b)');
        const today = by('c)');
        const future = by('d)');
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Ejecutados"
                value={formatInt(executed?.records ?? 0)}
                sub={formatPct(executed?.pct ?? 0)}
                tone="success"
              />
              <MetricCard
                label="Pendientes pasados"
                value={formatInt(past?.records ?? 0)}
                sub={formatPct(past?.pct ?? 0)}
                tone="destructive"
              />
              <MetricCard
                label="Pendientes hoy"
                value={formatInt(today?.records ?? 0)}
                sub={formatPct(today?.pct ?? 0)}
                tone="info"
              />
              <MetricCard
                label="Pendientes futuros"
                value={formatInt(future?.records ?? 0)}
                sub={formatPct(future?.pct ?? 0)}
                tone="info"
              />
            </div>
            <MetricTable<ExecutionStatusRow>
              columns={[
                { key: 'category', label: 'Categoría' },
                { key: 'records', label: 'Records', align: 'right', format: (v) => formatInt(v as number) },
                { key: 'pct', label: '%', align: 'right', format: (v) => formatPct(v as number) },
              ]}
              rows={rows}
              empty="Sin records."
            />
          </div>
        );
      }}
    />
  );
}

export function SeedStatusBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Cadenas por estado del seed"
      description="Salud de cada cadena según su último record."
      tooltip="Para cada cadena (assetId, operationId) toma el record más reciente (DISTINCT ON) y la clasifica: atrasada >6m / 1-6m / casi al día / proyectada a corto, medio, largo o muy largo. Cadenas atrasadas indican cron congelado por algún motivo; cadenas proyectadas a años indican siembra legacy/histórica."
      loader={() => loadSeedStatus(tenant)}
      render={(rows) => (
        <MetricTable<SeedStatusRow>
          columns={[
            { key: 'category', label: 'Estado' },
            { key: 'chains', label: 'Cadenas', align: 'right', format: (v) => formatInt(v as number) },
            { key: 'pct', label: '%', align: 'right', format: (v) => formatPct(v as number) },
          ]}
          rows={rows}
          empty="Sin cadenas."
        />
      )}
    />
  );
}

export function BagajeBlock({ tenant }: { tenant: string }) {
  const donutColors: Record<'G1' | 'G3' | 'G4', string> = {
    G1: '#c53e3e',
    G3: '#d97706',
    G4: '#944e8c',
  };
  return (
    <LazyBlock
      title="Datos zombi detectados (G1 + G3 + G4)"
      description="Records pendientes que el script de regeneración NO crearía."
      tooltip={
        'Cuantifica los records pendientes que las guardas del script detectarían como zombi: ' +
        'G1 = pendientes en activos jubilados (deregistered = true). ' +
        'G3 = duplicados de la triple (assetId, operationId, originalScheduledDate). ' +
        'G4 = pendientes sin contrato vigente que cubra (centro, maintenanceClass). ' +
        'Son la deuda técnica histórica acumulada por scripts legacy o por el cron antes de añadir guardas.'
      }
      loader={() => loadBagaje(tenant)}
      render={(rows) => {
        const donutData = rows.map((r) => ({
          label: `${r.category} — ${r.label}`,
          value: r.records,
          color: donutColors[r.category],
        }));
        return <DonutChart data={donutData} />;
      }}
    />
  );
}

const PAGE_SIZE = 20;

export function TopChainsBlock({ tenant }: { tenant: string }) {
  const [page, setPage] = useState(1);

  return (
    <LazyBlock
      key={`top-chains-${page}`}
      title={`Top cadenas por nº de records — página ${page} (${PAGE_SIZE}/pág)`}
      description="Cadenas con más records acumulados, ordenadas descendente."
      tooltip="Cadenas (assetId, operationId) con más records en la BD. Mezcla casos normativos esperables (operaciones diarias) con anomalías por backlog histórico o siembra anómala. Útil para localizar candidatos a revisar o limpiar. Pre-agrega por ids para evitar agrupar por todas las columnas."
      loader={() => loadTopChains(tenant, page, PAGE_SIZE)}
      render={(rows) => (
        <div className="space-y-3">
          <MetricTable<TopChainRow>
            columns={[
              { key: 'asset_name', label: 'Activo' },
              { key: 'operation_name', label: 'Operación' },
              { key: 'frequency', label: 'Frecuencia' },
              { key: 'n_records', label: 'Records', align: 'right', format: (v) => formatInt(v as number) },
              { key: 'osd_min', label: 'OSD mín', format: (v) => formatDate(v as string) },
              { key: 'osd_max', label: 'OSD máx', format: (v) => formatDate(v as string) },
              { key: 'span_years', label: 'Span (años)', align: 'right', format: (v) => formatInt(v as number) },
            ]}
            rows={rows}
            empty="Sin cadenas en esta página."
          />
          <div className="flex items-center justify-between text-xs text-foreground/60">
            <span>
              Mostrando filas {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length}.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-border bg-card px-3 py-1 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="font-mono">página {page}</span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={rows.length < PAGE_SIZE}
                className="rounded-md border border-border bg-card px-3 py-1 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    />
  );
}

export function ExtremesBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Records programados después de 2030"
      description="Proyecciones lejanas o errores de siembra adelantada."
      tooltip="Filtra los records con originalScheduledDate ≥ 2030-01-01 y agrupa por frecuencia. Suelen aparecer en operaciones plurianuales (cada 5 o 10 años) o por errores de siembra muy adelantada. Si aparecen muchas filas con frecuencias cortas (diaria, mensual), es una anomalía a investigar."
      loader={() => loadExtremeDates(tenant)}
      render={(rows) => (
        <MetricTable<ExtremeDateRow>
          columns={[
            { key: 'frequency', label: 'Frecuencia' },
            {
              key: 'records_post_2030',
              label: 'Records',
              align: 'right',
              format: (v) => formatInt(v as number),
            },
            { key: 'first_post_2030', label: 'Primera fecha', format: (v) => formatDate(v as string) },
            { key: 'last_post_2030', label: 'Última fecha', format: (v) => formatDate(v as string) },
          ]}
          rows={rows}
          empty="Sin records después de 2030."
        />
      )}
    />
  );
}
