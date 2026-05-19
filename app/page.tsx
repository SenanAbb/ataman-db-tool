import { listTenants } from '@/lib/queries/tenants';
import { TenantSelector } from '@/components/tenant-selector';
import { HealthPill } from '@/components/health-pill';
import { InventorySection } from '@/components/sections/inventory-section';
import { BagajeSection } from '@/components/sections/bagaje-section';
import { DiagnosticSection } from '@/components/sections/diagnostic-section';
import { DryRunSection } from '@/components/sections/dry-run-section';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: { tenant?: string };
}) {
  const tenant = searchParams.tenant?.trim() || undefined;
  const tenants = await listTenants();

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <header className="sticky top-0 z-20 -mx-6 mb-6 flex items-center justify-between gap-4 border-b border-border bg-card/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">ATAMAN DB Tool</h1>
          <HealthPill />
        </div>
        <TenantSelector tenants={tenants} current={tenant} />
      </header>

      <InventorySection tenant={tenant} />
      <BagajeSection tenant={tenant} />
      <DiagnosticSection tenant={tenant} />
      <DryRunSection tenant={tenant} />
    </main>
  );
}
