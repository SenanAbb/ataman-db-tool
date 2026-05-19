# ATAMAN DB Tool — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. This is a "use and throw" internal tooling project — no automated test suite. Each task ends with manual verification (run dev server, visit URL, check output) instead of TDD.

**Goal:** Build a local Next.js 14 observability tool to inspect operational metrics of the ATAMAN PostgreSQL database and dry-run the manual operation-records regeneration script (#1099), without writing anything to the DB.

**Architecture:** Next.js App Router with Server Components + Server Actions. URL `?tenant=<id>` is the single source of truth. Single-page scroll layout: Inventory → Bagaje → Dry-run. `pg` singleton pool, schema-name validated against `admin.tenants` before interpolation. Dark mode OLED only. Read-only against DB.

**Tech Stack:** Next.js 14, TypeScript, Tailwind v3, shadcn/ui, `pg`, `zod`, `recharts`, `lucide-react`, Fira Sans / Fira Code (Google Fonts).

**Working directory for all paths:** `/home/sanan.abbasov/ATAMAN/ataman-db-tool/`

**Verification convention:** Each task's final step is a manual verification (visit URL / read terminal output). Run `npm run dev` once at the end of Phase 1; leave it running for subsequent phases. If it crashes, the offending task's verification will catch it.

---

## Phase 1 — Scaffold

### Task 1.1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `app/`, `components/`, `lib/`

- [ ] **Step 1: Bootstrap Next.js**

Run from inside `/home/sanan.abbasov/ATAMAN/ataman-db-tool/`:

```bash
npx create-next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-turbo
```

Accept all interactive defaults. Tool installs Next 14 + TS + Tailwind + ESLint.

- [ ] **Step 2: Verify scaffold**

```bash
ls
```

Expected files present: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js` (or `.mjs`), `.gitignore`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `next-env.d.ts`, `public/`. Plus existing `docs/`.

- [ ] **Step 3: Install runtime dependencies**

```bash
npm install pg zod recharts lucide-react
npm install -D @types/pg
```

- [ ] **Step 4: Verify dependencies**

```bash
cat package.json | grep -E '"(pg|zod|recharts|lucide-react|@types/pg)"'
```

Expected output: all five lines present with version numbers.

---

### Task 1.2: Environment files and gitignore

**Files:**
- Create: `.env.example`
- Create: `.env.local`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.env.example`**

File: `.env.example`
```
DB_HOST=dev.ataman.es
DB_PORT=5432
DB_NAME=ataman
DB_USER=
DB_PASSWORD=
```

- [ ] **Step 2: Create `.env.local`**

File: `.env.local`
```
DB_HOST=dev.ataman.es
DB_PORT=5432
DB_NAME=ataman
DB_USER=<your-username>
DB_PASSWORD=<your-password>
```

(Operator fills `DB_USER` and `DB_PASSWORD` with their real credentials.)

- [ ] **Step 3: Append to `.gitignore`**

Append to existing `.gitignore`:

```
# Local DB credentials
.env.local

# OS
.DS_Store
```

- [ ] **Step 4: Verify `.env.local` is ignored**

```bash
git check-ignore -v .env.local 2>/dev/null || echo "not in a git repo yet — OK, no commits happen anyway"
```

Either prints the matching `.gitignore` rule, or prints the fallback message (the project is not initialized as a git repo and that is fine for a throwaway local tool).

---

### Task 1.3: Fonts, dark mode, global styles

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace `app/layout.tsx`**

File: `app/layout.tsx`
```tsx
import type { Metadata } from 'next';
import { Fira_Sans, Fira_Code } from 'next/font/google';
import './globals.css';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fira-sans',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fira-code',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ATAMAN DB Tool',
  description: 'Local observability tool for the ATAMAN database',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${firaSans.variable} ${firaCode.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `app/globals.css`**

File: `app/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-background: 2 6 23;          /* slate-950 */
    --color-foreground: 248 250 252;     /* slate-50 */
    --color-muted: 26 30 47;             /* card bg */
    --color-border: 51 65 85;            /* slate-600 */
    --color-primary: 15 23 42;           /* slate-900 */
    --color-accent: 34 197 94;           /* green-500 */
    --color-destructive: 239 68 68;      /* red-500 */
    --color-warning: 245 158 11;         /* amber-500 */
    --color-info: 56 189 248;            /* sky-400 */
  }

  html {
    font-family: var(--font-fira-sans), system-ui, sans-serif;
    font-size: 14px;
  }

  @media (max-width: 640px) {
    html {
      font-size: 16px;
    }
  }

  .font-mono,
  [class*='tabular'] {
    font-family: var(--font-fira-code), ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

- [ ] **Step 3: Replace `tailwind.config.ts`**

File: `tailwind.config.ts`
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        destructive: 'rgb(var(--color-destructive) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-fira-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-fira-code)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Replace `app/page.tsx` with placeholder**

File: `app/page.tsx`
```tsx
export default function Page() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-xl font-semibold">ATAMAN DB Tool</h1>
      <p className="mt-2 text-sm text-foreground/70">Scaffold OK.</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify dev server renders**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -20
```

Expected: HTML containing `ATAMAN DB Tool` and `Scaffold OK.`. Background-dark theme will only be visible in browser.

Stop server: `kill %1` (or leave it; we will reuse it in later tasks).

---

### Task 1.4: DB pool singleton

**Files:**
- Create: `lib/db.ts`

- [ ] **Step 1: Write `lib/db.ts`**

File: `lib/db.ts`
```ts
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function buildPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 5,
    statement_timeout: 30_000,
    idleTimeoutMillis: 30_000,
  });
}

export const pool: Pool = globalThis._pgPool ?? buildPool();

if (process.env.NODE_ENV !== 'production') {
  globalThis._pgPool = pool;
}
```

- [ ] **Step 2: Sanity check — file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors, exits 0.

---

### Task 1.5: Tenants query

**Files:**
- Create: `lib/queries/tenants.ts`

- [ ] **Step 1: Write `lib/queries/tenants.ts`**

File: `lib/queries/tenants.ts`
```ts
import { pool } from '../db';

export interface Tenant {
  id: string;
  name: string;
}

export async function listTenants(): Promise<Tenant[]> {
  const { rows } = await pool.query<Tenant>(
    `SELECT id, name FROM admin.tenants WHERE id <> $1 ORDER BY id`,
    ['admin'],
  );
  return rows;
}

export async function tenantExists(id: string): Promise<boolean> {
  if (!/^[a-z_][a-z0-9_]*$/.test(id)) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM admin.tenants WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows.length === 1;
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 1.6: Health endpoint

**Files:**
- Create: `app/api/health/route.ts`

- [ ] **Step 1: Write `app/api/health/route.ts`**

File: `app/api/health/route.ts`
```ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await pool.query<{ now: string }>('SELECT NOW()::text AS now');
    return NextResponse.json({ status: 'connected', now: rows[0].now });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify endpoint**

If dev server isn't running:

```bash
npm run dev &
sleep 5
```

Then:

```bash
curl -s http://localhost:3000/api/health
```

Expected response (assuming valid `.env.local`):
```json
{"status":"connected","now":"2026-05-18 ..."}
```

If credentials are wrong: `{"status":"error","error":"..."}` with HTTP 500.

---

### Task 1.7: Tenant selector component

**Files:**
- Create: `components/tenant-selector.tsx`

- [ ] **Step 1: Write `components/tenant-selector.tsx`**

File: `components/tenant-selector.tsx`
```tsx
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
        className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">— Aggregated (all tenants) —</option>
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
        Apply
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 1.8: Page skeleton with header

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

File: `app/page.tsx`
```tsx
import { listTenants } from '@/lib/queries/tenants';
import { TenantSelector } from '@/components/tenant-selector';

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
      <header className="sticky top-0 z-10 -mx-6 mb-6 flex items-center justify-between gap-4 bg-background/95 px-6 py-3 backdrop-blur border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">ATAMAN DB Tool</h1>
        <TenantSelector tenants={tenants} current={tenant} />
      </header>

      <section className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm">
          Current tenant: <span className="font-mono text-accent">{tenant ?? '— aggregated —'}</span>
        </p>
        <p className="mt-1 text-xs text-foreground/60">
          {tenants.length} tenant(s) available.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify the page in dev**

```bash
curl -s 'http://localhost:3000/' | grep -E '(ATAMAN DB Tool|aggregated|tenant)' | head -5
```

Expected: matches for the title, the selector label, and the aggregated marker. In a browser, hitting `http://localhost:3000/` should show the header with the dropdown populated by real tenants from `admin.tenants`, and the body showing `— aggregated —` until a tenant is picked.

Then verify selection works: pick a tenant in the dropdown → click Apply → URL becomes `?tenant=<id>` → body now shows that id.

---

### Task 1.9: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

File: `README.md`
```markdown
# ATAMAN DB Tool

Local Next.js app for inspecting operational metrics of the ATAMAN PostgreSQL database. Read-only. No deployment. No authentication.

## Setup

1. Copy `.env.example` to `.env.local` and fill `DB_USER` and `DB_PASSWORD` with your credentials.
2. `npm install`
3. `npm run dev`
4. Open http://localhost:3000

## What it does

- Inventory metrics per tenant (assets, chains, records distribution).
- Bagaje (zombie data) breakdown: deregistered assets, missing contracts, duplicates.
- Dry-run of the manual operation-records regeneration script — calculates how many records would be inserted, writes nothing.

## Security

App runs locally with the operator's DB credentials. There is no authentication layer. Do not expose the dev port externally.
```

- [ ] **Step 2: Phase 1 wrap-up check**

In a browser at `http://localhost:3000`:
- Page renders dark theme with Fira fonts.
- Header shows title and tenant dropdown.
- Status of `/api/health` is reachable (visit `/api/health` directly).
- Selecting a tenant updates the URL and the body label.

If all four pass, Phase 1 is done.

---

## Phase 2 — Inventory section

### Task 2.1: Shared types

**Files:**
- Create: `lib/types.ts`
- Create: `lib/format.ts`

- [ ] **Step 1: Write `lib/types.ts`**

File: `lib/types.ts`
```ts
export interface InventorySummary {
  assets_total: number;
  assets_active: number;
  assets_deregistered: number;
  chains: number;
  records_total: number;
}

export interface YearBucketRow {
  bucket: string;
  records: number;
  pct: number;
}

export interface FrequencyRow {
  frequency: string;
  chains: number;
  records: number;
}

export interface ExecutionStatusRow {
  category: string;
  records: number;
  pct: number;
}

export interface SeedStatusRow {
  category: string;
  chains: number;
  pct: number;
}

export interface BagajeRow {
  category: 'G1' | 'G3' | 'G4';
  label: string;
  records: number;
}

export interface TopChainRow {
  asset_id: number;
  asset_name: string;
  operation_id: number;
  operation_name: string;
  frequency: string;
  n_records: number;
  osd_min: string;
  osd_max: string;
  span_years: number | null;
}

export interface ExtremeDateRow {
  frequency: string;
  records_post_2030: number;
  first_post_2030: string;
  last_post_2030: string;
}

export interface DryRunResult {
  n_seeds: number;
  n_candidates: number;
  drop_g1: number;
  drop_g3: number;
  drop_g4: number;
  drop_g5: number;
  n_survivors: number;
  osd_min: string | null;
  osd_max: string | null;
  n_past: number;
  n_today: number;
  n_future: number;
  cap_exceeded: boolean;
  elapsed_ms: number;
}
```

- [ ] **Step 2: Write `lib/format.ts`**

File: `lib/format.ts`
```ts
const intFmt = new Intl.NumberFormat('es-ES');

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return intFmt.format(n);
}

export function formatPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(digits)} %`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return d.slice(0, 10);
}
```

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 2.2: Inventory queries

**Files:**
- Create: `lib/queries/inventory.ts`

This module needs three queries against a single tenant: inventory summary, year distribution (Q1 of `medicion-prod.sql`), frequency distribution (Q4 of `medicion-prod.sql`). The schema name is interpolated only after passing `tenantExists()` — schema identifiers cannot be parameterized in Postgres.

- [ ] **Step 1: Write `lib/queries/inventory.ts`**

File: `lib/queries/inventory.ts`
```ts
import { pool } from '../db';
import { tenantExists } from './tenants';
import type {
  InventorySummary,
  YearBucketRow,
  FrequencyRow,
} from '../types';

async function assertTenant(tenant: string): Promise<void> {
  const ok = await tenantExists(tenant);
  if (!ok) throw new Error(`Unknown or invalid tenant: ${tenant}`);
}

export async function getInventorySummary(tenant: string): Promise<InventorySummary> {
  await assertTenant(tenant);
  const sql = `
    SELECT
      (SELECT COUNT(*)::int FROM "${tenant}".assets)                                       AS assets_total,
      (SELECT COUNT(*)::int FROM "${tenant}".assets WHERE deregistered = false)            AS assets_active,
      (SELECT COUNT(*)::int FROM "${tenant}".assets WHERE deregistered = true)             AS assets_deregistered,
      (SELECT COUNT(DISTINCT ("assetId", "operationId"))::int
         FROM "${tenant}"."operationRecords")                                              AS chains,
      (SELECT COUNT(*)::int FROM "${tenant}"."operationRecords")                           AS records_total
  `;
  const { rows } = await pool.query<InventorySummary>(sql);
  return rows[0];
}

export async function getYearDistribution(tenant: string): Promise<YearBucketRow[]> {
  await assertTenant(tenant);
  const sql = `
    SELECT
      CASE
        WHEN "originalScheduledDate" < '2023-01-01' THEN 'a) Antes de 2023 (sospechoso)'
        WHEN "originalScheduledDate" < '2024-01-01' THEN 'b) 2023'
        WHEN "originalScheduledDate" < '2025-01-01' THEN 'c) 2024'
        WHEN "originalScheduledDate" < '2026-01-01' THEN 'd) 2025'
        WHEN "originalScheduledDate" < '2027-01-01' THEN 'e) 2026 (año actual)'
        WHEN "originalScheduledDate" < '2028-01-01' THEN 'f) 2027'
        WHEN "originalScheduledDate" < '2030-01-01' THEN 'g) 2028-2029'
        WHEN "originalScheduledDate" < '2035-01-01' THEN 'h) 2030-2034'
        ELSE                                              'i) 2035 en adelante'
      END                                            AS bucket,
      COUNT(*)::int                                  AS records,
      ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)::float AS pct
    FROM "${tenant}"."operationRecords"
    GROUP BY bucket
    ORDER BY bucket
  `;
  const { rows } = await pool.query<YearBucketRow>(sql);
  return rows;
}

export async function getFrequencyDistribution(tenant: string): Promise<FrequencyRow[]> {
  await assertTenant(tenant);
  const sql = `
    SELECT
      CONCAT(op."frequencyValue", ' ', op."frequencyUnits") AS frequency,
      COUNT(DISTINCT (opr."assetId", opr."operationId"))::int AS chains,
      COUNT(*)::int                                            AS records
    FROM "${tenant}"."operationRecords" opr
    JOIN admin.operations op ON op.id = opr."operationId"
    GROUP BY frequency
    ORDER BY records DESC
    LIMIT 15
  `;
  const { rows } = await pool.query<FrequencyRow>(sql);
  return rows;
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 2.3: MetricCard component

**Files:**
- Create: `components/metric-card.tsx`

- [ ] **Step 1: Write `components/metric-card.tsx`**

File: `components/metric-card.tsx`
```tsx
interface Props {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'accent' | 'destructive' | 'warning' | 'info';
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-foreground',
  accent: 'text-accent',
  destructive: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
};

export function MetricCard({ label, value, sub, tone = 'default' }: Props) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-foreground/60">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold ${TONE[tone]}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-foreground/50">{sub}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 2.4: MetricTable component

**Files:**
- Create: `components/metric-table.tsx`

- [ ] **Step 1: Write `components/metric-table.tsx`**

File: `components/metric-table.tsx`
```tsx
interface Column<T> {
  key: keyof T;
  label: string;
  align?: 'left' | 'right';
  format?: (v: T[keyof T], row: T) => string;
}

interface Props<T extends object> {
  title?: string;
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}

export function MetricTable<T extends object>({ title, columns, rows, empty }: Props<T>) {
  return (
    <div className="rounded-lg border border-border bg-muted/30">
      {title ? (
        <h3 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground/80">
          {title}
        </h3>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60">
            <tr>
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  className={`px-4 py-2 font-medium text-foreground/70 ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-foreground/50">
                  {empty ?? 'No data'}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-border/50 hover:bg-muted/40">
                  {columns.map((c) => {
                    const raw = row[c.key];
                    const text = c.format ? c.format(raw, row) : String(raw);
                    const isNumeric = c.align === 'right';
                    return (
                      <td
                        key={String(c.key)}
                        className={`px-4 py-2 ${
                          isNumeric ? 'text-right font-mono tabular-nums' : 'text-left'
                        }`}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 2.5: BarChart component (client)

**Files:**
- Create: `components/bar-chart.tsx`

- [ ] **Step 1: Write `components/bar-chart.tsx`**

File: `components/bar-chart.tsx`
```tsx
'use client';

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  data: Array<{ label: string; value: number }>;
  height?: number;
  fill?: string;
}

export function BarChart({ data, height = 280, fill = '#22C55E' }: Props) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RBarChart data={data} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#94A3B8" tick={{ fontSize: 12 }} />
          <YAxis stroke="#94A3B8" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: '#020617', border: '1px solid #334155', color: '#F8FAFC' }}
            cursor={{ fill: '#1A1E2F' }}
          />
          <Bar dataKey="value" fill={fill} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 2.6: Section header + skeleton

**Files:**
- Create: `components/section-header.tsx`
- Create: `components/skeleton.tsx`

- [ ] **Step 1: Write `components/section-header.tsx`**

File: `components/section-header.tsx`
```tsx
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-xs text-foreground/60">{description}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Write `components/skeleton.tsx`**

File: `components/skeleton.tsx`
```tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/60 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SectionSkeleton({ label }: { label: string }) {
  return (
    <section className="mt-8">
      <p className="mb-3 text-xs text-foreground/50">Loading {label}…</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="mt-4 h-64" />
    </section>
  );
}
```

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 2.7: Inventory section component

**Files:**
- Create: `components/sections/inventory-section.tsx`

- [ ] **Step 1: Write `components/sections/inventory-section.tsx`**

File: `components/sections/inventory-section.tsx`
```tsx
import { MetricCard } from '@/components/metric-card';
import { MetricTable } from '@/components/metric-table';
import { BarChart } from '@/components/bar-chart';
import { SectionHeader } from '@/components/section-header';
import {
  getInventorySummary,
  getYearDistribution,
  getFrequencyDistribution,
} from '@/lib/queries/inventory';
import { formatInt, formatPct } from '@/lib/format';
import type { YearBucketRow, FrequencyRow } from '@/lib/types';

export async function InventorySection({ tenant }: { tenant?: string }) {
  if (!tenant) {
    return (
      <section className="mt-8">
        <SectionHeader
          title="Inventory"
          description="Select a tenant in the header to load inventory metrics."
        />
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-foreground/60">
          No tenant selected. Aggregated inventory across tenants is not yet implemented in the MVP.
        </div>
      </section>
    );
  }

  const [summary, yearRows, freqRows] = await Promise.all([
    getInventorySummary(tenant),
    getYearDistribution(tenant),
    getFrequencyDistribution(tenant),
  ]);

  const yearChartData = yearRows.map((r) => ({ label: r.bucket.slice(3), value: r.records }));

  return (
    <section className="mt-8">
      <SectionHeader
        title="Inventory"
        description={`Tenant: ${tenant}. Counts and distributions over operation records.`}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Assets total"
          value={formatInt(summary.assets_total)}
          sub={`${formatInt(summary.assets_active)} active / ${formatInt(summary.assets_deregistered)} deregistered`}
        />
        <MetricCard label="Chains (asset, op)" value={formatInt(summary.chains)} />
        <MetricCard label="Records total" value={formatInt(summary.records_total)} tone="info" />
        <MetricCard
          label="Avg records per chain"
          value={
            summary.chains > 0
              ? formatInt(Math.round(summary.records_total / summary.chains))
              : '—'
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricTable<YearBucketRow>
          title="Records per year bucket"
          columns={[
            { key: 'bucket', label: 'Bucket' },
            { key: 'records', label: 'Records', align: 'right', format: (v) => formatInt(v as number) },
            { key: 'pct', label: '%', align: 'right', format: (v) => formatPct(v as number) },
          ]}
          rows={yearRows}
          empty="No records."
        />
        <MetricTable<FrequencyRow>
          title="Top 15 frequencies"
          columns={[
            { key: 'frequency', label: 'Frequency' },
            { key: 'chains', label: 'Chains', align: 'right', format: (v) => formatInt(v as number) },
            { key: 'records', label: 'Records', align: 'right', format: (v) => formatInt(v as number) },
          ]}
          rows={freqRows}
          empty="No operations."
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="mb-2 text-sm font-medium text-foreground/80">Records per year (chart)</h3>
        <BarChart data={yearChartData} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 2.8: Wire InventorySection into page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

File: `app/page.tsx`
```tsx
import { Suspense } from 'react';
import { listTenants } from '@/lib/queries/tenants';
import { TenantSelector } from '@/components/tenant-selector';
import { InventorySection } from '@/components/sections/inventory-section';
import { SectionSkeleton } from '@/components/skeleton';

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
      <header className="sticky top-0 z-10 -mx-6 mb-6 flex items-center justify-between gap-4 bg-background/95 px-6 py-3 backdrop-blur border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">ATAMAN DB Tool</h1>
        <TenantSelector tenants={tenants} current={tenant} />
      </header>

      <Suspense fallback={<SectionSkeleton label="inventory" />}>
        <InventorySection tenant={tenant} />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 2: Verify Phase 2 in browser**

If dev server isn't running: `npm run dev &; sleep 5`.

In a browser:
1. Open `http://localhost:3000`. Page shows header + "No tenant selected" placeholder.
2. Pick any tenant in the dropdown → Apply. URL becomes `?tenant=<id>`. Inventory section loads with: 4 KPI cards (assets / chains / records / avg), two tables (year buckets, frequencies), one bar chart.
3. Resize browser; charts and grids should reflow. Tabular columns must align right.

If all three pass, Phase 2 is done.

---

## Phase 3 — Bagaje section

### Task 3.1: Bagaje queries

**Files:**
- Create: `lib/queries/bagaje.ts`

- [ ] **Step 1: Write `lib/queries/bagaje.ts`**

File: `lib/queries/bagaje.ts`
```ts
import { pool } from '../db';
import { tenantExists } from './tenants';
import type {
  ExecutionStatusRow,
  SeedStatusRow,
  BagajeRow,
  TopChainRow,
  ExtremeDateRow,
} from '../types';

async function assertTenant(tenant: string): Promise<void> {
  const ok = await tenantExists(tenant);
  if (!ok) throw new Error(`Unknown or invalid tenant: ${tenant}`);
}

export async function getExecutionStatus(tenant: string): Promise<ExecutionStatusRow[]> {
  await assertTenant(tenant);
  const sql = `
    SELECT
      CASE
        WHEN "startDate" IS NOT NULL                                          THEN 'a) Ejecutados (legítimos)'
        WHEN "startDate" IS NULL AND "originalScheduledDate" <  CURRENT_DATE  THEN 'b) Pendientes pasados (no ejecutados)'
        WHEN "startDate" IS NULL AND "originalScheduledDate" =  CURRENT_DATE  THEN 'c) Pendientes hoy'
        WHEN "startDate" IS NULL AND "originalScheduledDate" >  CURRENT_DATE  THEN 'd) Pendientes futuros (proyecciones)'
      END                              AS category,
      COUNT(*)::int                    AS records,
      ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)::float AS pct
    FROM "${tenant}"."operationRecords"
    GROUP BY category
    ORDER BY category
  `;
  const { rows } = await pool.query<ExecutionStatusRow>(sql);
  return rows;
}

export async function getSeedStatus(tenant: string): Promise<SeedStatusRow[]> {
  await assertTenant(tenant);
  const sql = `
    WITH chain_seeds AS (
      SELECT "assetId", "operationId", MAX("originalScheduledDate") AS max_osd
      FROM "${tenant}"."operationRecords"
      GROUP BY "assetId", "operationId"
    )
    SELECT
      CASE
        WHEN max_osd < CURRENT_DATE - INTERVAL '6 months'  THEN 'a) Atrasadas (>6m)'
        WHEN max_osd < CURRENT_DATE - INTERVAL '1 month'   THEN 'b) Atrasadas (1-6m)'
        WHEN max_osd < CURRENT_DATE                        THEN 'c) Casi al día (<1m)'
        WHEN max_osd = CURRENT_DATE                        THEN 'd) Al día exacto'
        WHEN max_osd < CURRENT_DATE + INTERVAL '1 month'   THEN 'e) Proyectadas a corto (<1m)'
        WHEN max_osd < CURRENT_DATE + INTERVAL '1 year'    THEN 'f) Proyectadas a medio (1m-1y)'
        WHEN max_osd < CURRENT_DATE + INTERVAL '5 years'   THEN 'g) Proyectadas a largo (1-5y)'
        ELSE                                                    'h) Proyectadas a muy largo (>5y)'
      END             AS category,
      COUNT(*)::int   AS chains,
      ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)::float AS pct
    FROM chain_seeds
    GROUP BY category
    ORDER BY category
  `;
  const { rows } = await pool.query<SeedStatusRow>(sql);
  return rows;
}

export async function getBagaje(tenant: string): Promise<BagajeRow[]> {
  await assertTenant(tenant);
  const sql = `
    SELECT 'G1'::text AS category,
           'Pending in deregistered assets' AS label,
           COUNT(*)::int AS records
    FROM "${tenant}"."operationRecords" opr
    JOIN "${tenant}".assets a ON a.id = opr."assetId"
    WHERE opr."startDate" IS NULL
      AND opr."originalScheduledDate" >= CURRENT_DATE
      AND a.deregistered = true

    UNION ALL

    SELECT 'G4'::text AS category,
           'Pending without active contract' AS label,
           COUNT(*)::int AS records
    FROM "${tenant}"."operationRecords" opr
    JOIN "${tenant}".assets a ON a.id = opr."assetId"
    LEFT JOIN "${tenant}".rooms r ON r.id = a."roomId"
    LEFT JOIN "${tenant}".floors fl ON fl.id = r."floorId"
    JOIN admin.operations op ON op.id = opr."operationId"
    JOIN admin."assetSubtypes" asub ON asub.id = op."assetSubtypeId"
    JOIN admin."assetTypes" atyp ON atyp.id = asub."assetTypeId"
    WHERE opr."startDate" IS NULL
      AND opr."originalScheduledDate" >= CURRENT_DATE
      AND a.deregistered = false
      AND NOT EXISTS (
        SELECT 1 FROM "${tenant}".contracts ct
        JOIN "${tenant}"."contractMaintenanceClasses" cmc ON cmc."contractId" = ct.id
        WHERE ct."centerId" = fl."centerId"
          AND cmc."maintenanceClassId" = atyp."maintenanceClassId"
          AND ct."initDate" <= opr."originalScheduledDate"
          AND (ct."finishDate" IS NULL OR ct."finishDate" > opr."originalScheduledDate")
      )

    UNION ALL

    SELECT 'G3'::text AS category,
           'Duplicates of (assetId, operationId, originalScheduledDate)' AS label,
           COALESCE(SUM(extras), 0)::int AS records
    FROM (
      SELECT COUNT(*) - 1 AS extras
      FROM "${tenant}"."operationRecords"
      GROUP BY "assetId", "operationId", "originalScheduledDate"
      HAVING COUNT(*) > 1
    ) dup
  `;
  const { rows } = await pool.query<BagajeRow>(sql);
  return rows;
}

export async function getTopChains(tenant: string): Promise<TopChainRow[]> {
  await assertTenant(tenant);
  const sql = `
    SELECT
      opr."assetId"        AS asset_id,
      a.name               AS asset_name,
      opr."operationId"    AS operation_id,
      op.name              AS operation_name,
      CONCAT(op."frequencyValue", ' ', op."frequencyUnits") AS frequency,
      COUNT(*)::int        AS n_records,
      MIN(opr."originalScheduledDate")::text AS osd_min,
      MAX(opr."originalScheduledDate")::text AS osd_max,
      EXTRACT(YEAR FROM AGE(MAX(opr."originalScheduledDate"), MIN(opr."originalScheduledDate")))::int AS span_years
    FROM "${tenant}"."operationRecords" opr
    JOIN "${tenant}".assets a ON a.id = opr."assetId"
    JOIN admin.operations op ON op.id = opr."operationId"
    GROUP BY opr."assetId", a.name, opr."operationId", op.name, op."frequencyValue", op."frequencyUnits"
    ORDER BY n_records DESC
    LIMIT 20
  `;
  const { rows } = await pool.query<TopChainRow>(sql);
  return rows;
}

export async function getExtremeDates(tenant: string): Promise<ExtremeDateRow[]> {
  await assertTenant(tenant);
  const sql = `
    SELECT
      CONCAT(op."frequencyValue", ' ', op."frequencyUnits") AS frequency,
      COUNT(*)::int                          AS records_post_2030,
      MIN(opr."originalScheduledDate")::text AS first_post_2030,
      MAX(opr."originalScheduledDate")::text AS last_post_2030
    FROM "${tenant}"."operationRecords" opr
    JOIN admin.operations op ON op.id = opr."operationId"
    WHERE opr."originalScheduledDate" >= '2030-01-01'
    GROUP BY frequency
    ORDER BY records_post_2030 DESC
  `;
  const { rows } = await pool.query<ExtremeDateRow>(sql);
  return rows;
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 3.2: DonutChart component

**Files:**
- Create: `components/donut-chart.tsx`

- [ ] **Step 1: Write `components/donut-chart.tsx`**

File: `components/donut-chart.tsx`
```tsx
'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  data: Array<{ label: string; value: number; color: string }>;
  height?: number;
}

export function DonutChart({ data, height = 280 }: Props) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Tooltip
            contentStyle={{ background: '#020617', border: '1px solid #334155', color: '#F8FAFC' }}
          />
          <Legend wrapperStyle={{ color: '#F8FAFC', fontSize: 12 }} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} stroke="#020617" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 3.3: Bagaje section component

**Files:**
- Create: `components/sections/bagaje-section.tsx`

- [ ] **Step 1: Write `components/sections/bagaje-section.tsx`**

File: `components/sections/bagaje-section.tsx`
```tsx
import { MetricCard } from '@/components/metric-card';
import { MetricTable } from '@/components/metric-table';
import { DonutChart } from '@/components/donut-chart';
import { SectionHeader } from '@/components/section-header';
import {
  getExecutionStatus,
  getSeedStatus,
  getBagaje,
  getTopChains,
  getExtremeDates,
} from '@/lib/queries/bagaje';
import { formatInt, formatPct, formatDate } from '@/lib/format';
import type {
  SeedStatusRow,
  TopChainRow,
  ExtremeDateRow,
} from '@/lib/types';

export async function BagajeSection({ tenant }: { tenant?: string }) {
  if (!tenant) {
    return (
      <section className="mt-8">
        <SectionHeader
          title="Bagaje (status + zombie data)"
          description="Select a tenant in the header to load bagaje metrics."
        />
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-foreground/60">
          No tenant selected. Aggregated bagaje across tenants is not yet implemented in the MVP.
        </div>
      </section>
    );
  }

  const [execStatus, seedStatus, bagaje, topChains, extremes] = await Promise.all([
    getExecutionStatus(tenant),
    getSeedStatus(tenant),
    getBagaje(tenant),
    getTopChains(tenant),
    getExtremeDates(tenant),
  ]);

  const byCategory = (label: string) => execStatus.find((r) => r.category.startsWith(label));
  const executed = byCategory('a)');
  const pastPending = byCategory('b)');
  const todayPending = byCategory('c)');
  const futurePending = byCategory('d)');

  const donutColors: Record<'G1' | 'G3' | 'G4', string> = {
    G1: '#EF4444',
    G3: '#F59E0B',
    G4: '#A855F7',
  };
  const donutData = bagaje.map((r) => ({
    label: `${r.category} — ${r.label}`,
    value: r.records,
    color: donutColors[r.category],
  }));

  return (
    <section className="mt-8">
      <SectionHeader
        title="Bagaje (status + zombie data)"
        description={`Tenant: ${tenant}. Execution state, seed health, and zombie data detected by guards G1/G3/G4.`}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Executed"
          value={formatInt(executed?.records ?? 0)}
          sub={formatPct(executed?.pct ?? 0)}
          tone="accent"
        />
        <MetricCard
          label="Pending past"
          value={formatInt(pastPending?.records ?? 0)}
          sub={formatPct(pastPending?.pct ?? 0)}
          tone="destructive"
        />
        <MetricCard
          label="Pending today"
          value={formatInt(todayPending?.records ?? 0)}
          sub={formatPct(todayPending?.pct ?? 0)}
          tone="info"
        />
        <MetricCard
          label="Pending future"
          value={formatInt(futurePending?.records ?? 0)}
          sub={formatPct(futurePending?.pct ?? 0)}
          tone="info"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricTable<SeedStatusRow>
          title="Chains by seed status"
          columns={[
            { key: 'category', label: 'Status' },
            { key: 'chains', label: 'Chains', align: 'right', format: (v) => formatInt(v as number) },
            { key: 'pct', label: '%', align: 'right', format: (v) => formatPct(v as number) },
          ]}
          rows={seedStatus}
          empty="No chains."
        />
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="mb-2 text-sm font-medium text-foreground/80">
            Zombie data breakdown (G1 + G3 + G4)
          </h3>
          <DonutChart data={donutData} />
        </div>
      </div>

      <div className="mt-6">
        <MetricTable<TopChainRow>
          title="Top 20 chains by record count"
          columns={[
            { key: 'asset_name', label: 'Asset' },
            { key: 'operation_name', label: 'Operation' },
            { key: 'frequency', label: 'Frequency' },
            { key: 'n_records', label: 'Records', align: 'right', format: (v) => formatInt(v as number) },
            { key: 'osd_min', label: 'OSD min', format: (v) => formatDate(v as string) },
            { key: 'osd_max', label: 'OSD max', format: (v) => formatDate(v as string) },
            { key: 'span_years', label: 'Span (y)', align: 'right', format: (v) => formatInt(v as number) },
          ]}
          rows={topChains}
          empty="No chains."
        />
      </div>

      <div className="mt-6">
        <MetricTable<ExtremeDateRow>
          title="Records scheduled post-2030"
          columns={[
            { key: 'frequency', label: 'Frequency' },
            { key: 'records_post_2030', label: 'Records', align: 'right', format: (v) => formatInt(v as number) },
            { key: 'first_post_2030', label: 'First date', format: (v) => formatDate(v as string) },
            { key: 'last_post_2030', label: 'Last date', format: (v) => formatDate(v as string) },
          ]}
          rows={extremes}
          empty="No records past 2030."
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 3.4: Wire BagajeSection into page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

File: `app/page.tsx`
```tsx
import { Suspense } from 'react';
import { listTenants } from '@/lib/queries/tenants';
import { TenantSelector } from '@/components/tenant-selector';
import { InventorySection } from '@/components/sections/inventory-section';
import { BagajeSection } from '@/components/sections/bagaje-section';
import { SectionSkeleton } from '@/components/skeleton';

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
      <header className="sticky top-0 z-10 -mx-6 mb-6 flex items-center justify-between gap-4 bg-background/95 px-6 py-3 backdrop-blur border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">ATAMAN DB Tool</h1>
        <TenantSelector tenants={tenants} current={tenant} />
      </header>

      <Suspense fallback={<SectionSkeleton label="inventory" />}>
        <InventorySection tenant={tenant} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton label="bagaje" />}>
        <BagajeSection tenant={tenant} />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 2: Verify Phase 3 in browser**

In a browser at `http://localhost:3000/?tenant=<some-tenant>`:
1. After Inventory loads, Bagaje renders: 4 status KPIs, 2 tables side-by-side (seed status + donut), Top 20 table, post-2030 table.
2. KPI colors are: accent (green) for Executed, destructive (red) for Pending past, info (sky) for today + future.
3. Donut chart renders 3 slices (G1, G4, G3) with legend; hovering shows tooltip.

If all three pass, Phase 3 is done.

---

## Phase 4 — Dry-run section

### Task 4.1: Constants

**Files:**
- Create: `lib/constants.ts`

- [ ] **Step 1: Write `lib/constants.ts`**

File: `lib/constants.ts`
```ts
export const DRY_RUN_DEFAULTS = {
  safety_cap: 10_000,
  backfill_max_age_value: 3,
  backfill_max_age_unit: 'days' as const,
};

export const DRY_RUN_LIMITS = {
  safety_cap_max: 1_000_000,
  backfill_max_age_value_max: 365,
};
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 4.2: Dry-run query

**Files:**
- Create: `lib/queries/dry-run.ts`

This is a port of `dry-run-prod.sql`. The original is a PL/pgSQL `DO $$` block that emits diagnostics via `RAISE NOTICE`. `pg` cannot capture `NOTICE` output cleanly, so we port the logic to a single CTE-based `SELECT` that returns one aggregated row. Same guards, same formula.

- [ ] **Step 1: Write `lib/queries/dry-run.ts`**

File: `lib/queries/dry-run.ts`
```ts
import { pool } from '../db';
import { tenantExists } from './tenants';
import { DRY_RUN_LIMITS } from '../constants';
import type { DryRunResult } from '../types';

interface DryRunParams {
  tenant: string;
  safety_cap: number;
  backfill_max_age_value: number;
  backfill_max_age_unit: 'days' | 'weeks';
}

interface DryRunRow {
  n_seeds: string | null;
  n_candidates: string | null;
  drop_g1: string | null;
  drop_g3: string | null;
  drop_g4: string | null;
  drop_g5: string | null;
  n_survivors: string | null;
  osd_min: string | null;
  osd_max: string | null;
  n_past: string | null;
  n_today: string | null;
  n_future: string | null;
}

export async function runDryRun(params: DryRunParams): Promise<DryRunResult> {
  const { tenant, safety_cap, backfill_max_age_value, backfill_max_age_unit } = params;

  if (!(await tenantExists(tenant))) {
    throw new Error(`Unknown or invalid tenant: ${tenant}`);
  }
  if (safety_cap < 1 || safety_cap > DRY_RUN_LIMITS.safety_cap_max) {
    throw new Error(`safety_cap out of range`);
  }
  if (
    backfill_max_age_value < 1 ||
    backfill_max_age_value > DRY_RUN_LIMITS.backfill_max_age_value_max
  ) {
    throw new Error(`backfill_max_age out of range`);
  }

  const backfillInterval = `${backfill_max_age_value} ${backfill_max_age_unit}`;

  const sql = `
    WITH seeds AS (
      SELECT DISTINCT ON (opr."assetId", opr."operationId")
        opr."assetId",
        opr."operationId",
        opr."originalScheduledDate" AS last_osd,
        (op."frequencyValue" || ' ' || op."frequencyUnits")::interval AS step,
        a.deregistered,
        fl."centerId",
        atyp."maintenanceClassId"
      FROM "${tenant}"."operationRecords" opr
      JOIN admin.operations op    ON op.id    = opr."operationId"
      JOIN "${tenant}".assets a   ON a.id     = opr."assetId"
      LEFT JOIN "${tenant}".rooms r ON r.id   = a."roomId"
      LEFT JOIN "${tenant}".floors fl ON fl.id = r."floorId"
      JOIN admin."assetSubtypes" asub ON asub.id = op."assetSubtypeId"
      JOIN admin."assetTypes"    atyp ON atyp.id = asub."assetTypeId"
      WHERE op."frequencyValue" IS NOT NULL
        AND op."frequencyUnits" IS NOT NULL
      ORDER BY opr."assetId", opr."operationId", opr."originalScheduledDate" DESC
    ),
    candidates AS (
      SELECT
        s."assetId",
        s."operationId",
        s.step,
        s.deregistered,
        s."centerId",
        s."maintenanceClassId",
        gs.candidate_date::date AS candidate_date,
        EXTRACT(EPOCH FROM s.step) / 86400.0 AS freq_days
      FROM seeds s
      CROSS JOIN LATERAL generate_series(
        GREATEST(
          (s.last_osd + s.step)::timestamp,
          (NOW() - $1::interval)::timestamp
        ),
        (NOW() + s.step)::timestamp,
        s.step
      ) gs(candidate_date)
      WHERE s.step > interval '0'
    ),
    flagged AS (
      SELECT
        c.*,
        (c.deregistered IS DISTINCT FROM TRUE) AS passes_g1,
        (NOT EXISTS (
          SELECT 1
          FROM "${tenant}"."operationRecords" opr2
          WHERE opr2."assetId"               = c."assetId"
            AND opr2."operationId"           = c."operationId"
            AND opr2."originalScheduledDate" = c.candidate_date
        )) AS passes_g3,
        (EXISTS (
          SELECT 1
          FROM "${tenant}".contracts ct
          JOIN "${tenant}"."contractMaintenanceClasses" cmc
            ON cmc."contractId" = ct.id
          WHERE ct."centerId"            = c."centerId"
            AND cmc."maintenanceClassId" = c."maintenanceClassId"
            AND ct."initDate"           <= c.candidate_date
            AND (
              ct."finishDate" IS NULL
              OR ct."finishDate" > c.candidate_date
            )
        )) AS passes_g4,
        (CASE
          WHEN c.freq_days <= 1 THEN (c.candidate_date - CURRENT_DATE) <= 1
          WHEN c.freq_days <  7 THEN (c.candidate_date - CURRENT_DATE) <= 1
          WHEN c.freq_days < 28 THEN (c.candidate_date - CURRENT_DATE) <= 7
          ELSE                       (c.candidate_date - CURRENT_DATE) <= 30
        END) AS passes_g5
      FROM candidates c
    )
    SELECT
      (SELECT COUNT(DISTINCT ("assetId", "operationId"))::text FROM seeds) AS n_seeds,
      COUNT(*)::text                                                       AS n_candidates,
      COUNT(*) FILTER (WHERE NOT passes_g1)::text                          AS drop_g1,
      COUNT(*) FILTER (WHERE NOT passes_g3)::text                          AS drop_g3,
      COUNT(*) FILTER (WHERE NOT passes_g4)::text                          AS drop_g4,
      COUNT(*) FILTER (WHERE NOT passes_g5)::text                          AS drop_g5,
      COUNT(*) FILTER (WHERE passes_g1 AND passes_g3 AND passes_g4 AND passes_g5)::text AS n_survivors,
      MIN(candidate_date) FILTER (WHERE passes_g1 AND passes_g3 AND passes_g4 AND passes_g5)::text AS osd_min,
      MAX(candidate_date) FILTER (WHERE passes_g1 AND passes_g3 AND passes_g4 AND passes_g5)::text AS osd_max,
      COUNT(*) FILTER (WHERE passes_g1 AND passes_g3 AND passes_g4 AND passes_g5 AND candidate_date < CURRENT_DATE)::text AS n_past,
      COUNT(*) FILTER (WHERE passes_g1 AND passes_g3 AND passes_g4 AND passes_g5 AND candidate_date = CURRENT_DATE)::text AS n_today,
      COUNT(*) FILTER (WHERE passes_g1 AND passes_g3 AND passes_g4 AND passes_g5 AND candidate_date > CURRENT_DATE)::text AS n_future
    FROM flagged
  `;

  const started = Date.now();
  const { rows } = await pool.query<DryRunRow>(sql, [backfillInterval]);
  const elapsed_ms = Date.now() - started;
  const r = rows[0];

  const toInt = (v: string | null) => (v === null ? 0 : Number.parseInt(v, 10));
  const n_survivors = toInt(r.n_survivors);

  return {
    n_seeds: toInt(r.n_seeds),
    n_candidates: toInt(r.n_candidates),
    drop_g1: toInt(r.drop_g1),
    drop_g3: toInt(r.drop_g3),
    drop_g4: toInt(r.drop_g4),
    drop_g5: toInt(r.drop_g5),
    n_survivors,
    osd_min: r.osd_min ? r.osd_min.slice(0, 10) : null,
    osd_max: r.osd_max ? r.osd_max.slice(0, 10) : null,
    n_past: toInt(r.n_past),
    n_today: toInt(r.n_today),
    n_future: toInt(r.n_future),
    cap_exceeded: n_survivors > safety_cap,
    elapsed_ms,
  };
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 4.3: Dry-run Server Action

**Files:**
- Create: `app/actions/dry-run.ts`

- [ ] **Step 1: Write `app/actions/dry-run.ts`**

File: `app/actions/dry-run.ts`
```ts
'use server';

import { z } from 'zod';
import { runDryRun } from '@/lib/queries/dry-run';
import { DRY_RUN_LIMITS } from '@/lib/constants';
import type { DryRunResult } from '@/lib/types';

const schema = z.object({
  tenant: z.string().min(1).regex(/^[a-z_][a-z0-9_]*$/),
  safety_cap: z.coerce
    .number()
    .int()
    .positive()
    .max(DRY_RUN_LIMITS.safety_cap_max),
  backfill_max_age_value: z.coerce
    .number()
    .int()
    .positive()
    .max(DRY_RUN_LIMITS.backfill_max_age_value_max),
  backfill_max_age_unit: z.enum(['days', 'weeks']),
});

export interface DryRunActionState {
  error?: string;
  result?: DryRunResult;
  params?: z.infer<typeof schema>;
}

export async function dryRunAction(
  _prev: DryRunActionState,
  formData: FormData,
): Promise<DryRunActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }

  try {
    const result = await runDryRun(parsed.data);
    return { result, params: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, params: parsed.data };
  }
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 4.4: Dry-run section (client component with form + result)

**Files:**
- Create: `components/sections/dry-run-section.tsx`

- [ ] **Step 1: Write `components/sections/dry-run-section.tsx`**

File: `components/sections/dry-run-section.tsx`
```tsx
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { dryRunAction, type DryRunActionState } from '@/app/actions/dry-run';
import { DRY_RUN_DEFAULTS } from '@/lib/constants';
import { SectionHeader } from '@/components/section-header';
import { MetricCard } from '@/components/metric-card';
import { formatInt, formatDate } from '@/lib/format';

const INITIAL: DryRunActionState = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Simulating…' : 'Simular regeneración'}
    </button>
  );
}

export function DryRunSection({ tenant }: { tenant?: string }) {
  const [state, formAction] = useFormState(dryRunAction, INITIAL);
  const disabled = !tenant;

  return (
    <section className="mt-8">
      <SectionHeader
        title="Dry-run #1099 — manual regeneration simulator"
        description="Calculates how many operation records would be inserted by the manual regeneration script. Writes nothing to the database."
      />

      {disabled ? (
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-foreground/60">
          Select a tenant in the header to enable the simulator.
        </div>
      ) : (
        <form
          action={formAction}
          className="rounded-lg border border-border bg-muted/30 p-4"
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
                backfill_max_age (value)
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
                backfill_max_age (unit)
              </label>
              <select
                id="backfill_max_age_unit"
                name="backfill_max_age_unit"
                defaultValue={DRY_RUN_DEFAULTS.backfill_max_age_unit}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="days">days</option>
                <option value="weeks">weeks</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <SubmitButton disabled={disabled} />
            <span className="text-xs text-foreground/50">
              Read-only simulation. No INSERT is executed.
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
            : 'border-accent bg-accent/10 text-accent'
        }`}
      >
        {result.cap_exceeded
          ? `Would insert ${formatInt(result.n_survivors)} records in ${tenant} — exceeds safety_cap.`
          : `Would insert ${formatInt(result.n_survivors)} records in ${tenant}.`}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MetricCard label="Seeds (chains)" value={formatInt(result.n_seeds)} />
        <MetricCard label="Candidates" value={formatInt(result.n_candidates)} />
        <MetricCard label="Drop G1" value={formatInt(result.drop_g1)} tone="destructive" />
        <MetricCard label="Drop G3" value={formatInt(result.drop_g3)} tone="warning" />
        <MetricCard label="Drop G4" value={formatInt(result.drop_g4)} tone="destructive" />
        <MetricCard label="Drop G5" value={formatInt(result.drop_g5)} tone="info" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Would insert (past)" value={formatInt(result.n_past)} />
        <MetricCard label="Would insert (today)" value={formatInt(result.n_today)} tone="accent" />
        <MetricCard label="Would insert (future)" value={formatInt(result.n_future)} tone="info" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="OSD min" value={formatDate(result.osd_min)} />
        <MetricCard label="OSD max" value={formatDate(result.osd_max)} />
        <MetricCard label="Elapsed (ms)" value={formatInt(result.elapsed_ms)} />
      </div>

      <p className="mt-4 text-xs text-foreground/50">
        Simulation only — nothing was written to the database.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

---

### Task 4.5: Wire DryRunSection into page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

File: `app/page.tsx`
```tsx
import { Suspense } from 'react';
import { listTenants } from '@/lib/queries/tenants';
import { TenantSelector } from '@/components/tenant-selector';
import { InventorySection } from '@/components/sections/inventory-section';
import { BagajeSection } from '@/components/sections/bagaje-section';
import { DryRunSection } from '@/components/sections/dry-run-section';
import { SectionSkeleton } from '@/components/skeleton';

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
      <header className="sticky top-0 z-10 -mx-6 mb-6 flex items-center justify-between gap-4 bg-background/95 px-6 py-3 backdrop-blur border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">ATAMAN DB Tool</h1>
        <TenantSelector tenants={tenants} current={tenant} />
      </header>

      <Suspense fallback={<SectionSkeleton label="inventory" />}>
        <InventorySection tenant={tenant} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton label="bagaje" />}>
        <BagajeSection tenant={tenant} />
      </Suspense>

      <DryRunSection tenant={tenant} />
    </main>
  );
}
```

- [ ] **Step 2: Verify Phase 4 in browser**

In a browser at `http://localhost:3000/?tenant=<some-tenant>`:
1. Dry-run section appears at the bottom with form inputs `safety_cap` (10000), `backfill_max_age` value (3) + unit (days).
2. Click `Simular regeneración`. Button shows `Simulating…` state. After it returns, result block renders with banner ("Would insert N records") + 6 stat cards (seeds/candidates/dropG1/dropG3/dropG4/dropG5) + 3 temporal cards (past/today/future) + 3 metadata cards (osd_min/osd_max/elapsed_ms).
3. With no tenant selected (URL `/`), the section shows "Select a tenant in the header to enable the simulator."

If all three pass, Phase 4 is done.

---

## Phase 5 — Polish (optional)

### Task 5.1: Health status pill in header

**Files:**
- Create: `components/health-pill.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write `components/health-pill.tsx`**

File: `components/health-pill.tsx`
```tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type Status = 'loading' | 'connected' | 'error';

export function HealthPill() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setStatus(data.status === 'connected' ? 'connected' : 'error');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    check();
    const id = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const styles: Record<Status, string> = {
    loading: 'border-border bg-muted/30 text-foreground/60',
    connected: 'border-accent bg-accent/10 text-accent',
    error: 'border-destructive bg-destructive/10 text-destructive',
  };
  const Icon = status === 'loading' ? Loader2 : status === 'connected' ? CheckCircle2 : XCircle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
      aria-live="polite"
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
      {status === 'loading' ? 'Checking' : status === 'connected' ? 'DB connected' : 'DB error'}
    </span>
  );
}
```

- [ ] **Step 2: Wire pill into page header**

In `app/page.tsx`, add import and insert pill between title and selector:

```tsx
import { HealthPill } from '@/components/health-pill';
```

Replace the header element with:

```tsx
<header className="sticky top-0 z-10 -mx-6 mb-6 flex items-center justify-between gap-4 bg-background/95 px-6 py-3 backdrop-blur border-b border-border">
  <div className="flex items-center gap-3">
    <h1 className="text-lg font-semibold tracking-tight">ATAMAN DB Tool</h1>
    <HealthPill />
  </div>
  <TenantSelector tenants={tenants} current={tenant} />
</header>
```

- [ ] **Step 3: Verify health pill**

In a browser:
1. Header shows a pill next to the title. After ~1 s it should display "DB connected" with green color.
2. Stop the database (or break `DB_HOST`) and reload — the pill flips to red "DB error" within 30 s.

---

### Task 5.2: README polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md`**

File: `README.md`
```markdown
# ATAMAN DB Tool

Local Next.js 14 observability tool for the ATAMAN PostgreSQL database. Read-only. No deployment. No authentication. Single user, local only.

## Quick start

```bash
cp .env.example .env.local
# Edit .env.local and fill DB_USER + DB_PASSWORD with your credentials
npm install
npm run dev
```

Open http://localhost:3000

## Sections

- Inventory — assets, chains, records distribution per year, frequency breakdown.
- Bagaje — execution status, seed health, zombie data (G1 deregistered, G3 duplicates, G4 no-active-contract), top 20 chains, post-2030 outliers.
- Dry-run #1099 — simulates the manual operation-records regeneration. Reports how many records would be inserted, broken down by guard rejection (G1/G3/G4/G5). Writes nothing.

## URL state

`/?tenant=<id>` selects a tenant. No tenant → aggregated placeholder (inventory and bagaje show empty state in the MVP; dry-run disabled).

## Security

App runs locally with the operator's DB credentials. No auth layer. Do not expose the dev port externally. `.env.local` is gitignored.

## Architecture notes

- Server Components + Server Actions only. No client-side DB access. No `useEffect` for data fetching.
- `pg` singleton pool with `statement_timeout = 30s`. Schema names interpolated only after `tenantExists()` validation against `admin.tenants`.
- Dark mode OLED only. Fira Sans body / Fira Code numeric data.
```

---

## Self-review (run mentally after writing each task)

**Spec coverage:** Each section of the design spec maps to a task:
- Spec §2 stack → Task 1.1 + 1.3 dependencies.
- Spec §3 architecture (Server Components, URL as state, pool singleton) → Task 1.4, 1.8, 2.8, 3.4, 4.5.
- Spec §4 directory layout → all tasks (paths exact).
- Spec §5 data flow (page render, db singleton, tenant validation, server action) → Task 1.4, 1.5, 1.8, 4.3.
- Spec §6 UI/UX design system (colors, fonts, spacing, accessibility) → Task 1.3 (CSS vars + Tailwind + Fira fonts + reduced motion).
- Spec §7 section composition → Tasks 2.7 (Inventory: KPIs + Q1 + Q4), 3.3 (Bagaje: Q2 + Q3 + Q5 + Q6 + Q7), 4.4 (Dry-run form + result).
- Spec §8 env config → Task 1.2.
- Spec §9 phases → Phases 1-5 of this plan.
- Spec §10 out of scope → respected (no auth, no aggregated cross-tenant queries beyond placeholders, no light mode).
- Spec §11 anti-patterns → respected (no client-side DB, no emojis, schema interpolation gated by `tenantExists`, statement_timeout 30s, URL state only).

**Type consistency:** `Tenant`, `InventorySummary`, `YearBucketRow`, `FrequencyRow`, `ExecutionStatusRow`, `SeedStatusRow`, `BagajeRow`, `TopChainRow`, `ExtremeDateRow`, `DryRunResult` declared once in `lib/types.ts` (Task 2.1) and imported by every consumer. `DryRunActionState` declared in `app/actions/dry-run.ts` and imported by `dry-run-section.tsx`.

**Placeholder scan:** None — every step includes the full code or full command. Verification steps refer to concrete URLs and expected outputs.
