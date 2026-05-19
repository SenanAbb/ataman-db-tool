'use client';

import { useState } from 'react';
import { LazyBlock } from '@/components/lazy-block';
import { MetricCard } from '@/components/metric-card';
import { MetricTable } from '@/components/metric-table';
import { BarChart } from '@/components/bar-chart';
import {
  loadPendingMonthly,
  loadRecentBatchSummary,
  loadCronVsSeeds,
  loadChainSeedHealth,
} from '@/app/actions/queries';
import { formatInt, formatDate } from '@/lib/format';
import type { PendingMonthlyRow } from '@/lib/types';

export function PendingMonthlyBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Pendientes por mes"
      description="Distribución mensual de records sin ejecutar."
      tooltip="Cuenta los records con startDate IS NULL agrupados por mes de su originalScheduledDate. Permite ver dónde se acumula el backlog: meses pasados (visitas vencidas) frente a meses futuros (proyecciones). Si el cron sembró records futuros, los verás como meses adelante con miles de filas."
      loader={() => loadPendingMonthly(tenant)}
      render={(rows) => {
        const chart = rows.map((r) => ({ label: r.month.slice(0, 7), value: r.pending_count }));
        return (
          <div className="space-y-4">
            <BarChart data={chart} />
            <MetricTable<PendingMonthlyRow>
              columns={[
                { key: 'month', label: 'Mes', format: (v) => formatDate(v as string).slice(0, 7) },
                {
                  key: 'pending_count',
                  label: 'Pendientes',
                  align: 'right',
                  format: (v) => formatInt(v as number),
                },
              ]}
              rows={rows}
              empty="Sin pendientes."
            />
          </div>
        );
      }}
    />
  );
}

const DEFAULT_BATCH = 2000;

export function RecentBatchBlock({ tenant }: { tenant: string }) {
  const [batch, setBatch] = useState(DEFAULT_BATCH);
  const [committed, setCommitted] = useState(DEFAULT_BATCH);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <label htmlFor={`batch-recent-${tenant}`} className="text-foreground/70">
          Tamaño de lote
        </label>
        <input
          id={`batch-recent-${tenant}`}
          type="number"
          min={1}
          max={50000}
          value={batch}
          onChange={(e) => setBatch(Math.max(1, Number(e.target.value) || 1))}
          className="w-24 rounded-md border border-border bg-card px-2 py-1 font-mono"
        />
        <button
          type="button"
          onClick={() => setCommitted(batch)}
          className="rounded-md border border-border bg-card px-2 py-1 hover:bg-muted"
        >
          Aplicar
        </button>
        <span className="text-foreground/60">activo: {committed}</span>
      </div>
      <LazyBlock
        key={`recent-batch-${committed}`}
        title="Último lote insertado"
        description={`Últimos ${committed} records por id descendente (autoincrement).`}
        tooltip="Aprovecha que el id es autoincremental: los N records con id más alto son los últimos insertados por el cron (o por el script manual). Devuelve el rango de ids, el rango de originalScheduledDate y cuántos están pendientes vs ejecutados. Útil para localizar temporalmente el último batch que tocó la BD."
        loader={() => loadRecentBatchSummary(tenant, committed)}
        render={(r) => (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="id mín" value={formatInt(r.min_id)} />
            <MetricCard label="id máx" value={formatInt(r.max_id)} />
            <MetricCard label="OSD mín" value={formatDate(r.min_osd)} />
            <MetricCard label="OSD máx" value={formatDate(r.max_osd)} />
            <MetricCard label="Pendientes" value={formatInt(r.pending)} tone="destructive" />
            <MetricCard label="Ejecutados" value={formatInt(r.executed)} tone="success" />
          </div>
        )}
      />
    </div>
  );
}

export function CronVsSeedsBlock({ tenant }: { tenant: string }) {
  const [batch, setBatch] = useState(DEFAULT_BATCH);
  const [committed, setCommitted] = useState(DEFAULT_BATCH);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <label htmlFor={`batch-cron-${tenant}`} className="text-foreground/70">
          Tamaño de lote
        </label>
        <input
          id={`batch-cron-${tenant}`}
          type="number"
          min={1}
          max={50000}
          value={batch}
          onChange={(e) => setBatch(Math.max(1, Number(e.target.value) || 1))}
          className="w-24 rounded-md border border-border bg-card px-2 py-1 font-mono"
        />
        <button
          type="button"
          onClick={() => setCommitted(batch)}
          className="rounded-md border border-border bg-card px-2 py-1 hover:bg-muted"
        >
          Aplicar
        </button>
        <span className="text-foreground/60">activo: {committed}</span>
      </div>
      <LazyBlock
        key={`cron-vs-seeds-${committed}`}
        title="Lote insertado vs seeds actuales"
        description={`Comparativa de los últimos ${committed} records contra los seeds que tomaría el script de regeneración.`}
        tooltip={
          'Cuántos records del último lote (top N por id) coinciden con los seeds del dry-run. ' +
          'son_seed: el record es la última cabeza de su cadena, esperable y sano (confirma que el cron crea hacia adelante). ' +
          'no_son_seed: el cron creó este record pero la cadena ya tiene una OSD posterior — indicio de cadenas desordenadas o sembradas por script legacy. ' +
          'Si son_seed se acerca al tamaño del lote, el cron está alineado con el script; si no, hay desorden histórico.'
        }
        loader={() => loadCronVsSeeds(tenant, committed)}
        render={(r) => (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricCard
              label="Lote analizado"
              value={formatInt(r.cron_recent_batch)}
              sub={`tamaño solicitado: ${committed}`}
            />
            <MetricCard
              label="son_seed (esperable)"
              value={formatInt(r.son_seed)}
              tone="success"
              sub="cabezas de cadena"
            />
            <MetricCard
              label="no_son_seed (deuda)"
              value={formatInt(r.no_son_seed)}
              tone="destructive"
              sub="records intermedios"
            />
          </div>
        )}
      />
    </div>
  );
}

export function ChainSeedHealthBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Salud de seeds de cadenas"
      description="Reparto de cadenas según la antigüedad/proyección de su último record."
      tooltip={
        'Toma el último record de cada cadena (DISTINCT ON por assetId+operationId) y clasifica la cadena por su seed: ' +
        'chains_recent_seed_7d: cadenas renovadas en los últimos 7 días (saludable). ' +
        'chains_stale_seed_7d: cadenas sin renovar hace más de 7 días (el cron debería atenderlas y no lo hace — probablemente G4 las descarta por contrato caducado, o el activo está dado de baja). ' +
        'chains_future_seed: cadenas con seed ya proyectado al futuro — el cron y el script #1099 NO las tocarán porque no hay hueco que rellenar.'
      }
      loader={() => loadChainSeedHealth(tenant)}
      render={(r) => (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Cadenas totales" value={formatInt(r.chains_total)} />
          <MetricCard
            label="Seed reciente (≤7d)"
            value={formatInt(r.chains_recent_seed_7d)}
            tone="success"
          />
          <MetricCard
            label="Seed antiguo (>7d)"
            value={formatInt(r.chains_stale_seed_7d)}
            tone="destructive"
          />
          <MetricCard
            label="Seed ya futuro"
            value={formatInt(r.chains_future_seed)}
            tone="info"
          />
        </div>
      )}
    />
  );
}
