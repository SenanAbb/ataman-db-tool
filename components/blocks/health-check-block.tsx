'use client';

import { LazyBlock } from '@/components/lazy-block';
import { MetricCard } from '@/components/metric-card';
import { MetricTable } from '@/components/metric-table';
import { InfoTooltip } from '@/components/info-tooltip';
import {
  loadHealthCheck,
  loadHealthyChainsBreakdown,
  loadI3Refinement,
} from '@/app/actions/queries';
import { formatInt, formatPct } from '@/lib/format';
import type {
  HealthCheckResult,
  HealthyChainsResult,
  I3RefinementResult,
  PendingCountBucketRow,
} from '@/lib/types';

type Severity = 'ok' | 'caution' | 'alarm';

interface Interp {
  severity: Severity;
  label: string;
  message: string;
}

function pct(n: number, total: number): number {
  return total > 0 ? (100 * n) / total : 0;
}

function toneFor(p: number, cautionAt: number, alarmAt: number): 'default' | 'warning' | 'destructive' {
  if (p >= alarmAt) return 'destructive';
  if (p >= cautionAt) return 'warning';
  return 'default';
}

function deriveInterpretations(r: HealthCheckResult): Interp[] {
  const out: Interp[] = [];
  const total = r.total_chains;

  // I3 — duplicados pending
  // Esta métrica es RUIDOSA: el cron procesa ventana [ayer, hoy+30d] y crea siguientes pasos,
  // así que cadenas con frecuencia corta acumulan muchos pending coexistiendo por diseño normal
  // (diaria → ~31 pending sanos; semanal → 4-5; mensual → 1-2). Para separar ruido de bagaje real
  // ver el bloque "Refinamiento de I3" abajo (duplicados estrictos de la triple + distribución).
  const i3 = pct(r.chains_with_multiple_pending, total);
  if (total === 0 || i3 === 0) {
    out.push({
      severity: 'ok',
      label: 'I3 — duplicados pending (métrica ruidosa)',
      message: 'Sin cadenas con múltiples records pending. ✓',
    });
  } else {
    out.push({
      severity: 'caution',
      label: 'I3 — duplicados pending (métrica ruidosa)',
      message: `${i3.toFixed(1)} % con 2+ pending. La mayor parte suele ser comportamiento normal del cron sobre cadenas con frecuencia corta (diaria/semanal). Mira el bloque "Refinamiento de I3" abajo: I3a (duplicados estrictos de la triple) e I3b (distribución de pending por cadena) separan ruido de bagaje real.`,
    });
  }

  // I4 — desorden temporal
  const i4 = pct(r.chains_with_out_of_order_pending, total);
  if (total === 0 || i4 < 1) {
    out.push({
      severity: 'ok',
      label: 'I4 — desorden temporal',
      message: `${i4.toFixed(2)} % de cadenas con pending anterior a un ejecutado — caso raro, sin alarma.`,
    });
  } else {
    out.push({
      severity: 'caution',
      label: 'I4 — desorden temporal',
      message: `${i4.toFixed(1)} % con pending anterior a un ejecutado — posible cambio de frecuencia con recálculo incompleto, o intervención manual sembrando records en el pasado.`,
    });
  }

  // I5 — pending sin contrato vigente
  const i5 = pct(r.chains_with_uncovered_pending, total);
  if (total === 0 || i5 === 0) {
    out.push({
      severity: 'ok',
      label: 'I5 — pending sin contrato vigente',
      message: 'Todas las cadenas con pending tienen un contrato vigente cubriendo (centro, clase, tipo, fecha). ✓',
    });
  } else if (i5 < 10) {
    out.push({
      severity: 'caution',
      label: 'I5 — pending sin contrato vigente',
      message: `${i5.toFixed(1)} % de cadenas con pending sin contrato cubriendo — deuda menor. Cada uno es un record que el script #1099 rechazaría por G4.`,
    });
  } else {
    out.push({
      severity: 'alarm',
      label: 'I5 — pending sin contrato vigente',
      message: `${i5.toFixed(1)} % con pending sin contrato — bagaje histórico contractual (típico del script legacy paralelo, ver #1094). El cron post-#1094 y el script #1099 con guardas NO crean nuevos. Comprueba con un snapshot del día siguiente: si la cifra es estática, es deuda histórica, no problema actual.`,
    });
  }

  // I6 — pending en activos jubilados
  const i6 = pct(r.chains_pending_in_deregistered_assets, total);
  if (total === 0 || i6 < 2) {
    out.push({
      severity: 'ok',
      label: 'I6 — pending en activos jubilados',
      message: `${i6.toFixed(2)} % con pending en assets dados de baja — deuda menor.`,
    });
  } else if (i6 < 5) {
    out.push({
      severity: 'caution',
      label: 'I6 — pending en activos jubilados',
      message: `${i6.toFixed(1)} % con pending en assets jubilados — fix #887 podría estar incompleto en algún handler, o script legacy ignoró la baja.`,
    });
  } else {
    out.push({
      severity: 'alarm',
      label: 'I6 — pending en activos jubilados',
      message: `${i6.toFixed(1)} % con pending en assets jubilados — investigar fix #887 o script legacy ignorando la baja.`,
    });
  }

  return out;
}

const TOOLTIP_HC =
  'Comprueba cinco invariantes que toda cadena (assetId, operationId) sana debería cumplir, independientemente del script o del cron. ' +
  'Las propiedades dependen solo del estado actual de operationRecords + contracts + assets + operations. ' +
  'Cada conteo agregado dice cuántas cadenas violan la propiedad — si una propiedad falla en muchos casos, ahí está el bug o la deuda; si todas pasan, el sistema está sano aunque haya mucho volumen. ' +
  'Estos números se vuelven útiles cuando los comparas día a día: si crecen, hay un proceso sembrando deuda nueva.';

const TOOLTIP_INTERP =
  'Lectura automática de los conteos comparados con umbrales razonables. ' +
  'OK = invariante respetada. Atención = desviación pequeña, vigilar. Alarma = desviación grande, probable causa raíz indicada en el mensaje. ' +
  'Los umbrales son orientativos: 5 % para I3, 1 % para I4, 10 % para I5, 2 % y 5 % para I6.';

export function HealthCheckBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Invariantes de cadena (I3 — I6)"
      description="Cuántas cadenas violan cada propiedad esperada. Read-only sobre operationRecords + contracts + assets + operations."
      tooltip={TOOLTIP_HC}
      loader={() => loadHealthCheck(tenant)}
      render={(r) => {
        const interps = deriveInterpretations(r);
        const i3p = pct(r.chains_with_multiple_pending, r.total_chains);
        const i4p = pct(r.chains_with_out_of_order_pending, r.total_chains);
        const i5p = pct(r.chains_with_uncovered_pending, r.total_chains);
        const i6p = pct(r.chains_pending_in_deregistered_assets, r.total_chains);

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <MetricCard
                label="Cadenas totales"
                value={formatInt(r.total_chains)}
                sub="denominador"
                tone="info"
              />
              <MetricCard
                label="I3 — duplicados pending"
                value={formatInt(r.chains_with_multiple_pending)}
                sub={formatPct(i3p)}
                tone={toneFor(i3p, 1, 5)}
              />
              <MetricCard
                label="I4 — desorden temporal"
                value={formatInt(r.chains_with_out_of_order_pending)}
                sub={formatPct(i4p)}
                tone={toneFor(i4p, 0.5, 1)}
              />
              <MetricCard
                label="I5 — sin contrato vigente"
                value={formatInt(r.chains_with_uncovered_pending)}
                sub={formatPct(i5p)}
                tone={toneFor(i5p, 1, 10)}
              />
              <MetricCard
                label="I6 — activos jubilados"
                value={formatInt(r.chains_pending_in_deregistered_assets)}
                sub={formatPct(i6p)}
                tone={toneFor(i6p, 2, 5)}
              />
            </div>

            <div className="rounded-md border border-border bg-muted p-4">
              <div className="mb-3 flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground/90">Interpretación</h4>
                <InfoTooltip text={TOOLTIP_INTERP} />
              </div>
              <ul className="space-y-3">
                {interps.map((it) => (
                  <li key={it.label} className="flex items-start gap-3 text-sm">
                    <SeverityBadge severity={it.severity} />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground/90">{it.label}</p>
                      <p className="text-foreground/70">{it.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-border pt-3 text-xs text-foreground/60">
                <strong className="text-foreground/80">Cómo usar día a día:</strong> ejecuta este snapshot hoy y otro mañana tras el cron. Si los conteos no crecen (o solo cambian las cadenas sanas), el sistema actual no está sembrando deuda nueva — el bagaje es histórico estático. Si crecen, hay un proceso ajeno (script legacy, INSERTs manuales, otro cron) sembrando records nuevos a investigar.
              </p>
            </div>
          </div>
        );
      }}
    />
  );
}

const TOOLTIP_HEALTHY =
  'Cuenta cuántas cadenas (assetId, operationId) NO violan ninguna de las propiedades I3, I5 e I6. ' +
  'I4 se excluye por ser caso raro estadístico. ' +
  'Las violaciones se solapan: una sola cadena patológica (activo jubilado + contrato caducado + script legacy sembró pending al futuro) ' +
  'suele acumular las 3 violaciones a la vez. Por eso el conteo de cadenas "sanas" (chains_healthy = total - UNION violators) ' +
  'es el indicador más realista del estado del tenant. Si chains_healthy es muy bajo, la mayoría es deuda histórica heredada, ' +
  'no problemas actuales del cron — comprueba comparando con el día siguiente para confirmar estabilidad.';

function deriveHealthyVerdict(r: HealthyChainsResult): {
  severity: Severity;
  message: string;
} {
  const total = r.total_chains;
  if (total === 0) {
    return { severity: 'ok', message: 'Sin cadenas en el tenant.' };
  }
  const healthyPct = (100 * r.chains_healthy) / total;
  if (healthyPct >= 90) {
    return {
      severity: 'ok',
      message: `${healthyPct.toFixed(1)} % de cadenas sanas (sin violar I3/I5/I6). Sistema mayoritariamente limpio.`,
    };
  }
  if (healthyPct >= 50) {
    return {
      severity: 'caution',
      message: `${healthyPct.toFixed(1)} % sanas. La mitad del tenant arrastra deuda; conviene priorizar limpieza histórica supervisada.`,
    };
  }
  return {
    severity: 'alarm',
    message: `Solo ${healthyPct.toFixed(1)} % sanas — el tenant está prácticamente todo en deuda histórica heredada. Casi todas las cadenas patológicas suman las 3 violaciones (jubilado + contrato caducado + pending sembrado por script legacy). NO es problema del cron actual: confírmalo comparando este snapshot con el de mañana — si la cifra es estable, no se está sembrando deuda nueva.`,
  };
}

export function HealthyChainsBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Cadenas realmente sanas (resumen ejecutivo)"
      description="Total de cadenas que no violan ninguna de I3, I5 ni I6 (las violaciones se solapan)."
      tooltip={TOOLTIP_HEALTHY}
      loader={() => loadHealthyChainsBreakdown(tenant)}
      render={(r) => {
        const verdict = deriveHealthyVerdict(r);
        const healthyPct =
          r.total_chains > 0 ? (100 * r.chains_healthy) / r.total_chains : 0;
        const violatingPct =
          r.total_chains > 0 ? (100 * r.chains_violating_any) / r.total_chains : 0;

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <MetricCard
                label="Cadenas totales"
                value={formatInt(r.total_chains)}
                sub="denominador"
                tone="info"
              />
              <MetricCard
                label="Violan alguna (I3 ∪ I5 ∪ I6)"
                value={formatInt(r.chains_violating_any)}
                sub={formatPct(violatingPct)}
                tone={
                  violatingPct >= 50
                    ? 'destructive'
                    : violatingPct >= 10
                      ? 'warning'
                      : 'default'
                }
              />
              <MetricCard
                label="Cadenas sanas"
                value={formatInt(r.chains_healthy)}
                sub={formatPct(healthyPct)}
                tone={healthyPct >= 90 ? 'success' : healthyPct >= 50 ? 'warning' : 'destructive'}
              />
            </div>

            <div className="rounded-md border border-border bg-muted p-4">
              <div className="mb-2 flex items-center gap-2">
                <SeverityBadge severity={verdict.severity} />
                <h4 className="text-sm font-semibold text-foreground/90">Veredicto</h4>
              </div>
              <p className="text-sm text-foreground/80">{verdict.message}</p>
              <p className="mt-4 border-t border-border pt-3 text-xs text-foreground/60">
                <strong className="text-foreground/80">Recuerda:</strong> el conteo de cadenas sanas es lo que mueve el indicador de "el sistema está bien". El número en sí solo dice "tamaño del problema heredado"; la señal útil es su estabilidad o crecimiento día a día.
              </p>
            </div>
          </div>
        );
      }}
    />
  );
}

const TOOLTIP_I3REF =
  'Refina la lectura de I3 (duplicados pending) separando ruido del cron y bagaje real. ' +
  'I3a cuenta records con (assetId, operationId, originalScheduledDate) repetida — única violación REAL de la clave lógica de unicidad. Idealmente debe ser 0. ' +
  'I3b clasifica las cadenas según cuántos records pending coexisten: 1 (anual o cadena nueva), 2-7 (semanal/mensual sanos), 8-31 (diaria dentro de la ventana del cron, sano), 32-100 (anómalo moderado), >100 (bagaje injectado en serio). ' +
  'Si la mayoría cae en 8-31, el cron está procesando cadenas diarias con normalidad. Si hay cola larga (>100), es siembra histórica anómala.';

function summarizeDistribution(rows: PendingCountBucketRow[]) {
  const sumBetween = (lo: number, hi: number) =>
    rows
      .filter((d) => d.pending_count >= lo && d.pending_count <= hi)
      .reduce((s, d) => s + d.chains, 0);
  const sumAbove = (lo: number) =>
    rows.filter((d) => d.pending_count >= lo).reduce((s, d) => s + d.chains, 0);
  const total = rows.reduce((s, d) => s + d.chains, 0);
  return {
    total,
    b1: sumBetween(1, 1),
    b2: sumBetween(2, 7),
    b3: sumBetween(8, 31),
    b4: sumBetween(32, 100),
    b5: sumAbove(101),
  };
}

function deriveI3Verdict(r: I3RefinementResult): { severity: Severity; message: string } {
  const s = summarizeDistribution(r.pending_count_distribution);
  const pctB5 = s.total > 0 ? (100 * s.b5) / s.total : 0;
  const pctB4 = s.total > 0 ? (100 * s.b4) / s.total : 0;

  if (r.strict_triple_duplicates > 0) {
    return {
      severity: 'alarm',
      message: `${formatInt(r.strict_triple_duplicates)} records con (assetId, operationId, OSD) repetida — la clave lógica de unicidad está rota. Investigar el origen: script legacy, handleContractCreate sin guarda de duplicados, INSERTs manuales.`,
    };
  }
  if (s.b5 > 0 || pctB4 >= 5) {
    return {
      severity: 'alarm',
      message: `Cola larga detectada: ${formatInt(s.b5)} cadenas con >100 pending coexistiendo y ${formatInt(s.b4)} con 32-100. Eso es bagaje histórico real, no comportamiento normal del cron.`,
    };
  }
  if (pctB5 === 0 && pctB4 < 1) {
    return {
      severity: 'ok',
      message: `Sin duplicados estrictos y la distribución de pending coexistiendo es coherente con cadenas sanas de frecuencia corta (mayoría en 1-31). El I3 alto del bloque anterior es ruido del cron, no bagaje.`,
    };
  }
  return {
    severity: 'caution',
    message: `Sin duplicados estrictos pero hay algunas cadenas con pending elevado (32-100). Vigilar — puede ser ruido residual o inicio de bagaje.`,
  };
}

export function I3RefinementBlock({ tenant }: { tenant: string }) {
  return (
    <LazyBlock
      title="Refinamiento de I3 — bagaje real vs ruido del cron"
      description="I3a (duplicados estrictos de la triple) + I3b (distribución de pending coexistiendo por cadena)."
      tooltip={TOOLTIP_I3REF}
      loader={() => loadI3Refinement(tenant)}
      render={(r) => {
        const s = summarizeDistribution(r.pending_count_distribution);
        const verdict = deriveI3Verdict(r);
        const pct = (n: number) => (s.total > 0 ? (100 * n) / s.total : 0);

        return (
          <div className="space-y-6">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground/90">
                I3a — Duplicados estrictos de la triple (assetId, operationId, OSD)
              </h4>
              <MetricCard
                label="Records con clave (assetId, operationId, OSD) repetida"
                value={formatInt(r.strict_triple_duplicates)}
                sub={
                  r.strict_triple_duplicates === 0
                    ? 'Clave de unicidad respetada ✓'
                    : 'Hay violaciones reales de la clave lógica'
                }
                tone={r.strict_triple_duplicates === 0 ? 'success' : 'destructive'}
              />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground/90">
                I3b — Distribución de pending coexistiendo por cadena
              </h4>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                <MetricCard
                  label="1 pending (anual/nueva)"
                  value={formatInt(s.b1)}
                  sub={formatPct(pct(s.b1))}
                />
                <MetricCard
                  label="2-7 (semanal/mensual)"
                  value={formatInt(s.b2)}
                  sub={formatPct(pct(s.b2))}
                />
                <MetricCard
                  label="8-31 (diaria, ventana cron)"
                  value={formatInt(s.b3)}
                  sub={formatPct(pct(s.b3))}
                  tone="info"
                />
                <MetricCard
                  label="32-100 (moderado)"
                  value={formatInt(s.b4)}
                  sub={formatPct(pct(s.b4))}
                  tone={s.b4 > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label=">100 (bagaje serio)"
                  value={formatInt(s.b5)}
                  sub={formatPct(pct(s.b5))}
                  tone={s.b5 > 0 ? 'destructive' : 'default'}
                />
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground/90">Distribución completa</h4>
              <MetricTable<PendingCountBucketRow>
                columns={[
                  {
                    key: 'pending_count',
                    label: 'Pending coexistiendo',
                    align: 'right',
                    format: (v) => formatInt(v as number),
                  },
                  {
                    key: 'chains',
                    label: 'Cadenas',
                    align: 'right',
                    format: (v) => formatInt(v as number),
                  },
                ]}
                rows={r.pending_count_distribution}
                empty="Sin cadenas con pending."
              />
            </div>

            <div className="rounded-md border border-border bg-muted p-4">
              <div className="mb-2 flex items-center gap-2">
                <SeverityBadge severity={verdict.severity} />
                <h4 className="text-sm font-semibold text-foreground/90">Lectura</h4>
              </div>
              <p className="text-sm text-foreground/80">{verdict.message}</p>
              <p className="mt-4 border-t border-border pt-3 text-xs text-foreground/60">
                <strong className="text-foreground/80">Recuerda:</strong> el cron procesa la ventana [ayer, hoy+30d]. Una cadena diaria sana puede tener 31 pending coexistiendo sin que sea bug. Lo que sí es señal de deuda real son I3a (clave rota), buckets {'>'}100 e I5+I6 del bloque anterior.
              </p>
            </div>
          </div>
        );
      }}
    />
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, { className: string; label: string }> = {
    ok: { className: 'border-success bg-success/10 text-success', label: 'OK' },
    caution: { className: 'border-warning bg-warning/10 text-warning', label: 'Atención' },
    alarm: { className: 'border-destructive bg-destructive/10 text-destructive', label: 'Alarma' },
  };
  const m = map[severity];
  return (
    <span
      className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${m.className}`}
    >
      {m.label}
    </span>
  );
}
