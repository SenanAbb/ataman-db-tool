import { SectionHeader } from '@/components/section-header';
import {
  HealthCheckBlock,
  I3RefinementBlock,
  HealthyChainsBlock,
} from '@/components/blocks/health-check-block';

export function HealthCheckSection({ tenant }: { tenant?: string }) {
  if (!tenant) {
    return (
      <section className="mt-8">
        <SectionHeader
          title="Salud del sistema (invariantes de cadena)"
          description="Selecciona un tenant en la cabecera para ejecutar el health-check."
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
        title="Salud del sistema (invariantes de cadena)"
        description={`Tenant: ${tenant}. En vez de "¿el script está bien o mal?", contesta "¿qué propiedades cumple una cadena sana y cuántas las cumplen?". Si una propiedad falla en muchos casos, ahí está el bug o la deuda; si todas pasan, el sistema está sano.`}
      />

      <div className="space-y-4">
        <HealthCheckBlock tenant={tenant} />
        <I3RefinementBlock tenant={tenant} />
        <HealthyChainsBlock tenant={tenant} />
      </div>
    </section>
  );
}
