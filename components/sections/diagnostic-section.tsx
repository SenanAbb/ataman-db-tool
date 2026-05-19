import { SectionHeader } from '@/components/section-header';
import {
  PendingMonthlyBlock,
  RecentBatchBlock,
  CronVsSeedsBlock,
  ChainSeedHealthBlock,
} from '@/components/blocks/diagnostic-blocks';

export function DiagnosticSection({ tenant }: { tenant?: string }) {
  if (!tenant) {
    return (
      <section className="mt-8">
        <SectionHeader
          title="Diagnóstico del cron y script #1099"
          description="Selecciona un tenant en la cabecera para cargar las consultas de diagnóstico."
        />
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-foreground/60 shadow-sm">
          Sin tenant seleccionado. La vista agregada cross-tenant no está implementada en el MVP.
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <SectionHeader
        title="Diagnóstico del cron y script #1099"
        description={`Tenant: ${tenant}. Consultas pensadas para comprobar si el cron y el script de regeneración están haciendo su trabajo.`}
      />

      <div className="space-y-4">
        <PendingMonthlyBlock tenant={tenant} />
        <RecentBatchBlock tenant={tenant} />
        <CronVsSeedsBlock tenant={tenant} />
        <ChainSeedHealthBlock tenant={tenant} />
      </div>
    </section>
  );
}
