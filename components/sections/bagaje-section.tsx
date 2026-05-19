import { SectionHeader } from '@/components/section-header';
import {
  ExecutionStatusBlock,
  SeedStatusBlock,
  BagajeBlock,
  TopChainsBlock,
  ExtremesBlock,
} from '@/components/blocks/bagaje-blocks';

export function BagajeSection({ tenant }: { tenant?: string }) {
  if (!tenant) {
    return (
      <section className="mt-8">
        <SectionHeader
          title="Bagaje (estado + datos zombi)"
          description="Selecciona un tenant en la cabecera para cargar las métricas de bagaje."
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
        title="Bagaje (estado + datos zombi)"
        description={`Tenant: ${tenant}. El bloque de estado de ejecución se carga automáticamente; el resto son opt-in.`}
      />

      <div className="space-y-4">
        <ExecutionStatusBlock tenant={tenant} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SeedStatusBlock tenant={tenant} />
          <BagajeBlock tenant={tenant} />
        </div>
        <TopChainsBlock tenant={tenant} />
        <ExtremesBlock tenant={tenant} />
      </div>
    </section>
  );
}
