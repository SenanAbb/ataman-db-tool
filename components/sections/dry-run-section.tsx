'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { dryRunAction, type DryRunActionState } from '@/app/actions/dry-run';
import { DRY_RUN_DEFAULTS } from '@/lib/constants';
import { SectionHeader } from '@/components/section-header';
import { MetricCard } from '@/components/metric-card';
import { InfoTooltip } from '@/components/info-tooltip';
import { formatInt, formatDate } from '@/lib/format';

const INITIAL: DryRunActionState = {};

const DRY_RUN_TOOLTIP =
  'Simula el script SQL #1099 sin escribir nada en BD. ' +
  'Recorre los seeds (último record de cada cadena), genera candidates futuros con generate_series, ' +
  'y aplica las mismas 4 guardas que el script real: ' +
  'G1 (activo no jubilado), G3 (no duplicado de la triple assetId+operationId+OSD), ' +
  'G4 (existe contrato vigente que cubra) y G5 (threshold de frecuencia: la fecha está dentro de la ventana razonable). ' +
  'Reporta cuántos records insertaría, los descartes por cada guarda y la distribución temporal de la siembra prevista.';

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Simulando…' : 'Simular regeneración'}
    </button>
  );
}

export function DryRunSection({ tenant }: { tenant?: string }) {
  const [state, formAction] = useFormState(dryRunAction, INITIAL);
  const disabled = !tenant;

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <SectionHeader
          title="Simulación #1099 — regeneración manual"
          description="Calcula cuántos operationRecords se insertarían por el script de regeneración manual. No escribe nada en BD."
        />
        <InfoTooltip text={DRY_RUN_TOOLTIP} />
      </div>

      {disabled ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-foreground/60 shadow-sm">
          Selecciona un tenant en la cabecera para habilitar el simulador.
        </div>
      ) : (
        <form
          action={formAction}
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <input type="hidden" name="tenant" value={tenant} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="safety_cap" className="text-xs uppercase tracking-wide text-foreground/60">
                safety_cap
              </label>
              <input
                id="safety_cap"
                name="safety_cap"
                type="number"
                min={1}
                max={1_000_000}
                defaultValue={DRY_RUN_DEFAULTS.safety_cap}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="backfill_max_age_value" className="text-xs uppercase tracking-wide text-foreground/60">
                backfill_max_age (valor)
              </label>
              <input
                id="backfill_max_age_value"
                name="backfill_max_age_value"
                type="number"
                min={1}
                max={365}
                defaultValue={DRY_RUN_DEFAULTS.backfill_max_age_value}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="backfill_max_age_unit" className="text-xs uppercase tracking-wide text-foreground/60">
                backfill_max_age (unidad)
              </label>
              <select
                id="backfill_max_age_unit"
                name="backfill_max_age_unit"
                defaultValue={DRY_RUN_DEFAULTS.backfill_max_age_unit}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="days">días</option>
                <option value="weeks">semanas</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <SubmitButton disabled={disabled} />
            <span className="text-xs text-foreground/60">
              Simulación read-only. No se ejecuta ningún INSERT.
            </span>
          </div>

          {state.error ? (
            <div className="mt-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          ) : null}

          {state.result ? <DryRunResultBlock result={state.result} tenant={tenant} /> : null}
        </form>
      )}
    </section>
  );
}

function DryRunResultBlock({
  result,
  tenant,
}: {
  result: NonNullable<DryRunActionState['result']>;
  tenant: string;
}) {
  return (
    <div className="mt-6">
      <div
        className={`mb-4 rounded-md border p-3 text-sm font-medium ${
          result.cap_exceeded
            ? 'border-destructive bg-destructive/10 text-destructive'
            : 'border-success bg-success/10 text-success'
        }`}
      >
        {result.cap_exceeded
          ? `Insertaría ${formatInt(result.n_survivors)} records en ${tenant} — excede safety_cap.`
          : `Insertaría ${formatInt(result.n_survivors)} records en ${tenant}.`}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MetricCard label="Seeds (cadenas)" value={formatInt(result.n_seeds)} />
        <MetricCard label="Candidatos" value={formatInt(result.n_candidates)} />
        <MetricCard label="Descarta G1" value={formatInt(result.drop_g1)} tone="destructive" />
        <MetricCard label="Descarta G3" value={formatInt(result.drop_g3)} tone="warning" />
        <MetricCard label="Descarta G4" value={formatInt(result.drop_g4)} tone="destructive" />
        <MetricCard label="Descarta G5" value={formatInt(result.drop_g5)} tone="info" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Insertaría (pasado)" value={formatInt(result.n_past)} />
        <MetricCard label="Insertaría (hoy)" value={formatInt(result.n_today)} tone="success" />
        <MetricCard label="Insertaría (futuro)" value={formatInt(result.n_future)} tone="info" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="OSD mín" value={formatDate(result.osd_min)} />
        <MetricCard label="OSD máx" value={formatDate(result.osd_max)} />
        <MetricCard label="Tiempo (ms)" value={formatInt(result.elapsed_ms)} />
      </div>

      <p className="mt-4 text-xs text-foreground/60">
        Simulación únicamente — no se escribió nada en la base de datos.
      </p>
    </div>
  );
}
