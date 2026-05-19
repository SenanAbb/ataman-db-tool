import { pool } from '../db';
import { tenantExists } from './tenants';
import type {
  PendingMonthlyRow,
  RecentBatchSummary,
  CronVsSeedsResult,
  ChainSeedHealth,
} from '../types';

async function assertTenant(tenant: string): Promise<void> {
  const ok = await tenantExists(tenant);
  if (!ok) throw new Error(`Unknown or invalid tenant: ${tenant}`);
}

/** Query A — distribución temporal de records pendientes por mes (OSD). */
export async function getPendingMonthly(tenant: string): Promise<PendingMonthlyRow[]> {
  await assertTenant(tenant);
  const sql = `
    SELECT
      date_trunc('month', "originalScheduledDate")::date::text AS month,
      COUNT(*)::int                                            AS pending_count
    FROM "${tenant}"."operationRecords"
    WHERE "startDate" IS NULL
    GROUP BY 1
    ORDER BY 1
  `;
  const { rows } = await pool.query<PendingMonthlyRow>(sql);
  return rows;
}

/** Query B — resumen del último lote insertado (top N por id desc, autoincrement). */
export async function getRecentBatchSummary(
  tenant: string,
  batchSize: number,
): Promise<RecentBatchSummary> {
  await assertTenant(tenant);
  const safeBatch = Math.max(1, Math.min(Math.floor(batchSize), 50_000));
  const sql = `
    WITH recent AS (
      SELECT id, "originalScheduledDate", "startDate"
      FROM "${tenant}"."operationRecords"
      ORDER BY id DESC
      LIMIT $1
    )
    SELECT
      MIN(id)::int                            AS min_id,
      MAX(id)::int                            AS max_id,
      MIN("originalScheduledDate")::text      AS min_osd,
      MAX("originalScheduledDate")::text      AS max_osd,
      COUNT(*) FILTER (WHERE "startDate" IS NULL)::int     AS pending,
      COUNT(*) FILTER (WHERE "startDate" IS NOT NULL)::int AS executed
    FROM recent
  `;
  const { rows } = await pool.query<Omit<RecentBatchSummary, 'batch_size'>>(sql, [safeBatch]);
  return { batch_size: safeBatch, ...rows[0] };
}

/** Query C — solapamiento del último lote del cron con los seeds que tomaría el script #1099. */
export async function getCronVsSeeds(
  tenant: string,
  batchSize: number,
): Promise<CronVsSeedsResult> {
  await assertTenant(tenant);
  const safeBatch = Math.max(1, Math.min(Math.floor(batchSize), 50_000));
  const sql = `
    WITH cron_last_batch AS (
      SELECT id, "assetId", "operationId", "originalScheduledDate"
      FROM "${tenant}"."operationRecords"
      ORDER BY id DESC
      LIMIT $1
    ),
    seeds_today AS (
      SELECT DISTINCT ON ("assetId", "operationId")
        id, "assetId", "operationId", "originalScheduledDate" AS last_osd
      FROM "${tenant}"."operationRecords"
      ORDER BY "assetId", "operationId", "originalScheduledDate" DESC
    )
    SELECT
      COUNT(*)::int                                    AS cron_recent_batch,
      COUNT(*) FILTER (WHERE s.id IS NOT NULL)::int    AS son_seed,
      COUNT(*) FILTER (WHERE s.id IS NULL)::int        AS no_son_seed
    FROM cron_last_batch c
    LEFT JOIN seeds_today s ON s.id = c.id
  `;
  const { rows } = await pool.query<Omit<CronVsSeedsResult, 'batch_size'>>(sql, [safeBatch]);
  return { batch_size: safeBatch, ...rows[0] };
}

/** Query D — salud agregada de los seeds (último record por cadena). */
export async function getChainSeedHealth(tenant: string): Promise<ChainSeedHealth> {
  await assertTenant(tenant);
  const sql = `
    SELECT
      COUNT(*)::int                                                                  AS chains_total,
      COUNT(*) FILTER (WHERE last_osd >= CURRENT_DATE - INTERVAL '7 days')::int      AS chains_recent_seed_7d,
      COUNT(*) FILTER (WHERE last_osd <  CURRENT_DATE - INTERVAL '7 days')::int      AS chains_stale_seed_7d,
      COUNT(*) FILTER (WHERE last_osd >= CURRENT_DATE + INTERVAL '1 day')::int       AS chains_future_seed
    FROM (
      SELECT DISTINCT ON ("assetId", "operationId")
        "originalScheduledDate" AS last_osd
      FROM "${tenant}"."operationRecords"
      ORDER BY "assetId", "operationId", "originalScheduledDate" DESC
    ) chains
  `;
  const { rows } = await pool.query<ChainSeedHealth>(sql);
  return rows[0];
}
