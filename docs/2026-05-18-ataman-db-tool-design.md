# ATAMAN DB Tool — Design Spec

**Date:** 2026-05-18
**Status:** Approved — ready for implementation plan
**Type:** Internal observability tooling (auxiliary, single-user, local-only)

---

## 1. Purpose

Local Next.js app to inspect operational metrics of the ATAMAN backend PostgreSQL database that are not visible from the customer-facing app. Two primary capabilities:

1. **Inventory + bagaje metrics per tenant** — reuses validated queries from `.claude/context/1099_manual-script-with-guards/medicion-prod.sql` (Q1–Q7).
2. **Dry-run of the manual operation-records regeneration script (#1099)** — calculates how many records would be inserted, without writing anything to the DB.

Read-only against the database. Never writes. Runs locally via `npm run dev` only — not deployed anywhere, no authentication, security model relies on the operator already having DB credentials.

---

## 2. Stack

- **Next.js 14 App Router** + **TypeScript**
- **Tailwind v3** + **shadcn/ui**
- **`pg`** (node-postgres) — only non-Next runtime dependency
- **Recharts** — for distribution charts
- **`zod`** — for Server Action input validation
- **Lucide** — icons (no emojis ever)
- **Fira Sans** (body) + **Fira Code** (numbers, tabular data) — Google Fonts

---

## 3. Architecture (Approach A — Server Components + Server Actions)

URL `?tenant=<id>` is the single source of truth.

- Without `?tenant` → **aggregated view**: same metrics, but summed across all tenants (SQL queries replace `<tenant>.<table>` interpolation with a `UNION ALL` over every tenant in `admin.tenants`, or a `WITH RECURSIVE` loop in the query helper). Tables that don't make sense aggregated (e.g. top-20 chains per tenant) show a "select a tenant to view" placeholder instead. The dry-run section is disabled (button greyed out, message "Select a tenant to simulate").
- With `?tenant=<id>` → single-tenant view: queries hit `<tenant>.<table>` directly. All sections fully functional.

All DB queries run server-side in Server Components or Server Actions. No SWR, no client-side fetching, no `useEffect`. The browser receives pre-rendered HTML with already-resolved data.

Single page scroll layout. Header sticky on top. Below: 3 sections vertically stacked (Inventory → Bagaje → Dry-run). Each section is an `async` Server Component wrapped in `<Suspense>` for progressive streaming.

The pg pool is a singleton via `globalThis._pgPool` — survives Next.js dev hot-reload. Max 5 connections. `statement_timeout` 30s per query (safety against long scans on prod).

---

## 4. Directory layout

```
ataman-db-tool/
  app/
    layout.tsx                 # dark mode root, Fira fonts
    page.tsx                   # Server Component, reads ?tenant param
    actions/
      dry-run.ts               # Server Action — validates input + runs dry-run SQL
    api/
      health/route.ts          # GET — pings DB pool, returns status
  components/
    tenant-selector.tsx        # form action → ?tenant=X
    section-header.tsx
    metric-card.tsx            # KPI card
    metric-table.tsx           # sticky head, tabular-nums
    bar-chart.tsx              # Recharts wrapper
    donut-chart.tsx
    skeleton.tsx
    sections/
      inventory-section.tsx
      bagaje-section.tsx
      dry-run-section.tsx
  lib/
    db.ts                      # singleton pg.Pool + safeQuery helper
    queries/
      inventory.ts             # Q1, Q2 ported to TS
      bagaje.ts                # Q3–Q7
      dry-run.ts               # parametrized dry-run
      tenants.ts               # listTenants(), tenantExists()
    types.ts
    constants.ts               # safety_cap=10000, backfill=3 defaults
    format.ts                  # formatInt, formatPct, formatDate
  .env.local                   # gitignored
  .env.example                 # committed
  .gitignore
  next.config.mjs
  tailwind.config.ts
  postcss.config.mjs
  tsconfig.json
  package.json
  README.md
```

---

## 5. Data flow

### Page render (Server Component)

```ts
export default async function Page({ searchParams }: { searchParams: { tenant?: string } }) {
  const tenant = searchParams.tenant;
  const tenants = await listTenants();
  return (
    <main>
      <Header tenants={tenants} current={tenant} />
      <Suspense fallback={<Skeleton />}><InventorySection tenant={tenant} /></Suspense>
      <Suspense fallback={<Skeleton />}><BagajeSection tenant={tenant} /></Suspense>
      <DryRunSection tenant={tenant} />
    </main>
  );
}
```

### DB singleton (`lib/db.ts`)

```ts
import { Pool } from 'pg';
declare global { var _pgPool: Pool | undefined; }

export const pool = globalThis._pgPool ?? new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
  statement_timeout: 30000,
});

if (process.env.NODE_ENV !== 'production') globalThis._pgPool = pool;
```

### Tenant validation (anti-SQL-injection)

PostgreSQL schema identifiers cannot be parametrized via `$1`. The tenant name is interpolated directly into SQL after being validated against `admin.tenants`. The helper:

```ts
export async function tenantExists(t: string): Promise<boolean> {
  if (!/^[a-z_][a-z0-9_]*$/.test(t)) return false;
  const { rows } = await pool.query('SELECT 1 FROM admin.tenants WHERE id = $1 LIMIT 1', [t]);
  return rows.length === 1;
}
```

Every query function that interpolates schema must call `tenantExists()` first and throw if false.

### Server Action (`app/actions/dry-run.ts`)

```ts
'use server';
import { z } from 'zod';

const schema = z.object({
  tenant: z.string().min(1).regex(/^[a-z_][a-z0-9_]*$/),
  safety_cap: z.coerce.number().int().positive().max(1_000_000),
  backfill_max_age_value: z.coerce.number().int().positive().max(365),
  backfill_max_age_unit: z.enum(['days', 'weeks']),
});

export async function runDryRun(prevState: unknown, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
  if (!(await tenantExists(parsed.data.tenant))) return { error: 'Unknown tenant' };
  const result = await runDryRunQuery(parsed.data);
  return { result };
}
```

---

## 6. UI/UX design system (applied from ui-ux-pro-max)

**Pattern:** minimal single-column dashboard
**Style:** Dark mode OLED only (no light toggle — scope reduction)
**Type:** admin/data tooling

### Colors (CSS vars in `globals.css`)

```css
--color-background: #020617;     /* slate-950 */
--color-foreground: #F8FAFC;     /* slate-50 */
--color-muted: #1A1E2F;          /* card bg */
--color-border: #334155;         /* slate-600 */
--color-primary: #0F172A;        /* slate-900 */
--color-accent: #22C55E;         /* green-500 — OK / positive */
--color-destructive: #EF4444;    /* red-500 — bagaje / errors */
--color-warning: #F59E0B;        /* amber-500 — caution */
--color-info: #38BDF8;           /* sky-400 — neutral chart series */
```

### Typography

- `Fira Sans` body (400), labels (500), headings (600/700).
- `Fira Code` for numeric data (tabular figures, monospaced alignment in tables).
- Base 14px desktop (dense admin tooling), 16px on mobile (avoids iOS auto-zoom).

### Spacing

Tailwind scale 4/8/16/24/32/48. Max container width 1280px. Padding 24px horizontal.

### Component grids

KPI cards: 4-col desktop, 2-col tablet, 1-col mobile.
Tables: full width within container, sticky header, tabular-nums.
Charts: 100% width of section, fixed height 280px.

### Accessibility (CRITICAL — rules 1–2 of ui-ux-pro-max)

- Contrast ≥4.5:1 — slate-50 on slate-950 verified.
- Visible focus rings (2px ring-accent) on all interactive elements.
- `aria-label` on icon-only buttons.
- `prefers-reduced-motion` respected — chart animations disabled.
- Keyboard navigation supported through native form/select elements.

### States

- **Loading:** skeleton shimmer (rule `progressive-loading`, >1s).
- **Empty:** "No data for this tenant" message + link to aggregated view.
- **Error:** toast destructive + retry button.

### Icons

Lucide React only. Never emojis as structural icons.

---

## 7. Section composition

### Header (sticky top)

- Title text "ATAMAN DB Tool" (Fira Sans 600, 18px).
- DB status pill — green "connected" / red "error". Small client component polling `/api/health` every 30s.
- Tenant selector — `<form>` with shadcn Select + Apply button. Submit navigates to `?tenant=X`. No JavaScript required.

### Section 1 — Inventory (inventory preamble + Q1 + Q4 of `medicion-prod.sql`)

- 4 KPI cards: total assets (active + deregistered breakdown) | chains (assetId, operationId) | total records | tenants count.
- Table: records per year (year bucket | count | percentage), sticky head — sourced from Q1.
- Table: distribution by operation frequency (e.g. `1 day`, `1 month`) — chain count, total records, sourced from Q4.
- Bar chart: records per year (visual aid for the Q1 table).

### Section 2 — Status / Bagaje (Q2 + Q3 + Q5 + Q6 + Q7 of `medicion-prod.sql`)

- 4 KPI cards: executed | pending past | pending today | pending future — color-coded (green / red / sky / sky). Sourced from Q2.
- Table: chains by seed status (overdue >6m | overdue 1-6m | almost on time | on time today | projected short/medium/long). Sourced from Q3.
- Donut chart: bagaje breakdown — G1 (deregistered assets) + G3 (duplicates) + G4 (no active contract). All slices in destructive color, distinguished by pattern/label. Sourced from Q5.
- Table: top 20 chains with most records. Sourced from Q6.
- Table: records with extreme dates (post-2030). Sourced from Q7.

### Section 3 — Dry-run #1099

**Form (client component for `useFormState`):**

- `safety_cap` — number input, default 10000, min 0, max 1000000.
- `backfill_max_age` — number input + unit select (days / weeks), default 3 days.
- Submit button "Simular regeneración" — disabled until a tenant is selected.

**Result (rendered after Server Action returns):**

- Banner: "Would insert N records in tenant X" (green) or "Cap exceeded — aborted" (red).
- Table per guard: G1 rejections | G3 rejections | G4 rejections | G5 rejections | survivors | would insert.
- Table: temporal distribution of what would be inserted (past / today / future buckets).
- Footer: execution time in ms + reminder "simulation only — nothing written".

---

## 8. Environment configuration

`.env.example` (committed):

```
DB_HOST=dev.ataman.es
DB_PORT=5432
DB_NAME=ataman
DB_USER=
DB_PASSWORD=
DB_SCHEMA_ADMIN=admin
```

`.env.local` (gitignored) — each operator fills with their own credentials.

`.gitignore` includes `.env.local`, `node_modules`, `.next`, `*.log`.

`README.md` — 4 steps: clone, copy `.env.example` to `.env.local`, fill credentials, `npm install && npm run dev`.

---

## 9. Implementation phases

**Phase 1 — Scaffold (estimated 1–2 h)**
Next.js init, Tailwind + shadcn install, dark mode layout, Fira fonts, `lib/db.ts` pool, `/api/health` endpoint, `listTenants()` query, `TenantSelector` component. Page renders header + selector + status pill only.

**Phase 2 — Inventory (1–2 h)**
Port Q1+Q2 to `lib/queries/inventory.ts`. Build `InventorySection` with 4 KPI cards, 2 tables, 1 bar chart. Skeleton fallback. Both aggregated and single-tenant modes.

**Phase 3 — Bagaje (1–2 h)**
Port Q3–Q7 to `lib/queries/bagaje.ts`. Build `BagajeSection` with 4 status KPIs, seed table, donut chart, top-20 table, extremes table.

**Phase 4 — Dry-run (1–2 h)**
Port `dry-run-prod.sql` to `lib/queries/dry-run.ts` with parameterization. Form component, Server Action, result render.

**Phase 5 — Polish (optional, ~1 h)**
Health check polling, missing skeletons, README, reduced-motion verification, manual cross-browser sanity check.

Total estimated: 6–8 hours of implementation.

---

## 10. Out of scope (future iterations)

- Cron health check view (how many nights cron has missed).
- Expired contracts per tenant view.
- Deregistered assets with active chains list.
- Light mode toggle.
- Authentication / multi-user.
- Deployment to any environment.

---

## 11. Anti-patterns explicitly avoided

- No client-side DB credentials — `pg` is server-only.
- No emojis as icons.
- No light mode default (project chose dark-only).
- No SQL string concatenation with user input — schema identifier is validated against `admin.tenants` before interpolation; everything else uses `$1`-style parameters.
- No retry-loops or polling against the DB — single queries with `statement_timeout`.
- No global state on the client — URL `?tenant=X` is the only state.
- No `useEffect` for data fetching — Server Components only.
