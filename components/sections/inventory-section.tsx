import { SectionHeader } from '@/components/section-header';
import {
  InventorySummaryBlock,
  YearDistributionBlock,
  FrequencyDistributionBlock,
} from '@/components/blocks/inventory-blocks';

export function InventorySection({ tenant }: { tenant?: string }) {
  if (!tenant) {
    return (
      <section className="mt-8">
        <SectionHeader
          title="Inventario"
          description="Selecciona un tenant en la cabecera para cargar las métricas de inventario."
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
        title="Inventario"
        description={`Tenant: ${tenant}. El resumen se carga automáticamente; los bloques pesados son opt-in (botón Cargar).`}
      />

      <div className="space-y-4">
        <InventorySummaryBlock tenant={tenant} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <YearDistributionBlock tenant={tenant} />
          <FrequencyDistributionBlock tenant={tenant} />
        </div>
      </div>
    </section>
  );
}
