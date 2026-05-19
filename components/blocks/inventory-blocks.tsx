'use client';

import { LazyBlock } from '@/components/lazy-block';
import { MetricCard } from '@/components/metric-card';
import { MetricTable } from '@/components/metric-table';
import { BarChart } from '@/components/bar-chart';
import {
  loadInventorySummary,
  loadYearDistribution,
  loadFrequencyDistribution,
} from '@/app/actions/queries';
import { formatInt, formatPct } from '@/lib/format';
import type { YearBucketRow, FrequencyRow } from '@/lib/types';

export function InventorySummaryBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Resumen de inventario"
      description="Conteos básicos del tenant. Suele ser rápido."
      tooltip="Conteos directos del tenant: total de activos (con desglose alta/baja por el campo deregistered), nº de cadenas únicas (parejas assetId, operationId) y records totales en operationRecords. Es la foto general del volumen de datos del tenant."
      initialAutoLoad
      loader={() => loadInventorySummary(tenant)}
      render={(s) => (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Activos totales"
            value={formatInt(s.assets_total)}
            sub={`${formatInt(s.assets_active)} alta / ${formatInt(s.assets_deregistered)} baja`}
          />
          <MetricCard label="Cadenas (activo, operación)" value={formatInt(s.chains)} />
          <MetricCard label="Records totales" value={formatInt(s.records_total)} tone="info" />
          <MetricCard
            label="Records/cadena (media)"
            value={s.chains > 0 ? formatInt(Math.round(s.records_total / s.chains)) : '—'}
          />
        </div>
      )}
    />
  );
}

export function YearDistributionBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Records por año"
      description="Distribución temporal de los records por originalScheduledDate."
      tooltip="Bucketiza originalScheduledDate por año (con buckets sospechosos pre-2023 y proyecciones lejanas >2030) y cuenta records en cada uno. Sirve para detectar siembra histórica anómala (records pre-software) o proyecciones excesivas al futuro. Es un escaneo completo de operationRecords."
      loader={() => loadYearDistribution(tenant)}
      render={(rows) => {
        const chartData = rows.map((r) => ({ label: r.bucket.slice(3), value: r.records }));
        return (
          <div className="space-y-4">
            <MetricTable<YearBucketRow>
              columns={[
                { key: 'bucket', label: 'Bucket' },
                { key: 'records', label: 'Records', align: 'right', format: (v) => formatInt(v as number) },
                { key: 'pct', label: '%', align: 'right', format: (v) => formatPct(v as number) },
              ]}
              rows={rows}
              empty="Sin records."
            />
            <BarChart data={chartData} />
          </div>
        );
      }}
    />
  );
}

export function FrequencyDistributionBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Top 15 frecuencias de operación"
      description="Qué frecuencias dominan el volumen de records."
      tooltip="Pre-agrega por operationId (cheap), luego resuelve la frecuencia (1 day, 1 month, etc.) solo para las 15 operaciones con más records. Sirve para entender qué frecuencias estructuran el backlog: las diarias normativas (Legionella, RITE) suelen generar la mayor parte del volumen."
      loader={() => loadFrequencyDistribution(tenant)}
      render={(rows) => (
        <MetricTable<FrequencyRow>
          columns={[
            { key: 'frequency', label: 'Frecuencia' },
            { key: 'chains', label: 'Cadenas', align: 'right', format: (v) => formatInt(v as number) },
            { key: 'records', label: 'Records', align: 'right', format: (v) => formatInt(v as number) },
          ]}
          rows={rows}
          empty="Sin operaciones."
        />
      )}
    />
  );
}
