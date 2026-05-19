import type { Tenant } from '@/lib/queries/tenants';

export function TenantSelector({ tenants, current }: { tenants: Tenant[]; current?: string }) {
  return (
    <form action="/" method="get" className="flex items-center gap-2">
      <label htmlFor="tenant" className="text-sm text-foreground/70">
        Tenant
      </label>
      <select
        id="tenant"
        name="tenant"
        defaultValue={current ?? ''}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">— Agregado (todos los tenants) —</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id}
            {t.name && t.name !== t.id ? ` (${t.name})` : ''}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Aplicar
      </button>
    </form>
  );
}
