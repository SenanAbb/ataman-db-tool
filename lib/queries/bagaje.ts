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
  // DISTINCT ON lets Postgres use a (assetId, operationId, originalScheduledDate)
  // ordered index if available, returning one row per chain without hashing all.
  const sql = `
    WITH chain_seeds AS (
      SELECT DISTINCT ON ("assetId", "operationId")
        "assetId",
        "operationId",
        "originalScheduledDate" AS max_osd
      FROM "${tenant}"."operationRecords"
      ORDER BY "assetId", "operationId", "originalScheduledDate" DESC
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

export async function getTopChains(
  tenant: string,
  options: { limit?: number; offset?: number } = {},
): Promise<TopChainRow[]> {
  await assertTenant(tenant);
  const limit = Math.max(1, Math.min(options.limit ?? 20, 200));
  const offset = Math.max(0, options.offset ?? 0);
  // Pre-aggregate by ids only, then JOIN names for the top N + offset slice.
  // Cheaper than grouping by all 6 columns over the whole table.
  const sql = `
    WITH agg AS (
      SELECT
        "assetId",
        "operationId",
        COUNT(*)::int AS n_records,
        MIN("originalScheduledDate")::text AS osd_min,
        MAX("originalScheduledDate")::text AS osd_max
      FROM "${tenant}"."operationRecords"
      GROUP BY "assetId", "operationId"
      ORDER BY n_records DESC
      LIMIT ${limit} OFFSET ${offset}
    )
    SELECT
      a.id                AS asset_id,
      a.name              AS asset_name,
      op.id               AS operation_id,
      op.name             AS operation_name,
      CONCAT(op."frequencyValue", ' ', op."frequencyUnits") AS frequency,
      agg.n_records       AS n_records,
      agg.osd_min         AS osd_min,
      agg.osd_max         AS osd_max,
      EXTRACT(YEAR FROM AGE(agg.osd_max::date, agg.osd_min::date))::int AS span_years
    FROM agg
    JOIN "${tenant}".assets a ON a.id = agg."assetId"
    JOIN admin.operations op  ON op.id = agg."operationId"
    ORDER BY agg.n_records DESC
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
