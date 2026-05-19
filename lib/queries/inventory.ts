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
  // Pre-aggregate by operationId (no JOIN), then resolve the frequency label for the
  // top 15 only. Grouping by integer FK is much cheaper than grouping by CONCAT(text).
  // chains == COUNT(DISTINCT assetId) within a single operationId.
  const sql = `
    WITH agg AS (
      SELECT
        "operationId",
        COUNT(DISTINCT "assetId")::int AS chains,
        COUNT(*)::int                  AS records
      FROM "${tenant}"."operationRecords"
      GROUP BY "operationId"
      ORDER BY records DESC
      LIMIT 15
    )
    SELECT
      CONCAT(op."frequencyValue", ' ', op."frequencyUnits") AS frequency,
      a.chains                                              AS chains,
      a.records                                             AS records
    FROM agg a
    JOIN admin.operations op ON op.id = a."operationId"
    ORDER BY a.records DESC
  `;
  const { rows } = await pool.query<FrequencyRow>(sql);
  return rows;
}
