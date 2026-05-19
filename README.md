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
