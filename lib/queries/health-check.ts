import { pool } from '../db';
import { tenantExists } from './tenants';
import type {
  HealthCheckResult,
  HealthyChainsResult,
  I3RefinementResult,
  PendingCountBucketRow,
} from '../types';

/**
 * Health-check: comprueba invariantes de las cadenas (assetId, operationId) en operationRecords.
 * Cada invariante devuelve un conteo agregado de cadenas que la violan. El total da el denominador.
 *
 * Las 5 queries se ejecutan en paralelo (Promise.all) → 5 conexiones del pool concurrentemente.
 */

async function getTotalChains(tenant: string): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    `SELECT COUNT(DISTINCT ("assetId", "operationId"))::int AS total
     FROM "${tenant}"."operationRecords"`,
  );
  return rows[0]?.total ?? 0;
}

async function getMultiplePending(tenant: string): Promise<number> {
  const sql = `
    SELECT COUNT(*)::int AS chains
    FROM (
      SELECT "assetId", "operationId"
      FROM "${tenant}"."operationRecords"
      WHERE "startDate" IS NULL
      GROUP BY "assetId", "operationId"
      HAVING COUNT(*) > 1
    ) sub
  `;
  const { rows } = await pool.query<{ chains: number }>(sql);
  return rows[0]?.chains ?? 0;
}

async function getOutOfOrderPending(tenant: string): Promise<number> {
  const sql = `
    SELECT COUNT(*)::int AS chains
    FROM (
      SELECT
        "assetId",
        "operationId",
        MAX("originalScheduledDate") FILTER (WHERE "startDate" IS NULL)     AS max_pending_osd,
        MAX("originalScheduledDate") FILTER (WHERE "startDate" IS NOT NULL) AS max_executed_osd
      FROM "${tenant}"."operationRecords"
      GROUP BY "assetId", "operationId"
    ) sub
    WHERE max_pending_osd IS NOT NULL
      AND max_executed_osd IS NOT NULL
      AND max_pending_osd < max_executed_osd
  `;
  const { rows } = await pool.query<{ chains: number }>(sql);
  return rows[0]?.chains ?? 0;
}

async function getUncoveredPending(tenant: string): Promise<number> {
  const sql = `
    SELECT COUNT(DISTINCT (opr."assetId", opr."operationId"))::int AS chains
    FROM "${tenant}"."operationRecords" opr
    JOIN "${tenant}".assets a ON a.id = opr."assetId"
    JOIN "${tenant}".rooms r ON r.id = a."roomId"
    JOIN "${tenant}".floors fl ON fl.id = r."floorId"
    JOIN admin.operations op ON op.id = opr."operationId"
    JOIN admin."assetSubtypes" asub ON asub.id = op."assetSubtypeId"
    JOIN admin."assetTypes" atyp ON atyp.id = asub."assetTypeId"
    WHERE opr."startDate" IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "${tenant}".contracts c
        JOIN "${tenant}"."contractMaintenanceClasses" cmc ON cmc."contractId" = c.id
        JOIN "${tenant}"."contractMaintenanceTypes"   cmt ON cmt."contractId" = c.id
        WHERE c."centerId"           = fl."centerId"
          AND cmc."maintenanceClassId" = atyp."maintenanceClassId"
          AND cmt."maintenanceTypeId"  = op."maintenanceTypeId"
          AND c."initDate"            <= opr."originalScheduledDate"
          AND (c."finishDate" IS NULL OR c."finishDate" > opr."originalScheduledDate")
      )
  `;
  const { rows } = await pool.query<{ chains: number }>(sql);
  return rows[0]?.chains ?? 0;
}

async function getDeregisteredPending(tenant: string): Promise<number> {
  const sql = `
    SELECT COUNT(DISTINCT (opr."assetId", opr."operationId"))::int AS chains
    FROM "${tenant}"."operationRecords" opr
    JOIN "${tenant}".assets a ON a.id = opr."assetId"
    WHERE opr."startDate" IS NULL
      AND a.deregistered = true
  `;
  const { rows } = await pool.query<{ chains: number }>(sql);
  return rows[0]?.chains ?? 0;
}

/**
 * I3a — duplicados estrictos de la triple (assetId, operationId, originalScheduledDate).
 * Si > 0, hay violaciones reales de la clave lógica de unicidad (los pending múltiples no son
 * "fechas distintas dentro de la ventana del cron", son auténticos duplicados).
 */
async function getStrictTripleDuplicates(tenant: string): Promise<number> {
  const sql = `
    SELECT COUNT(*)::int AS dupes
    FROM (
      SELECT "assetId", "operationId", "originalScheduledDate"
      FROM "${tenant}"."operationRecords"
      GROUP BY "assetId", "operationId", "originalScheduledDate"
      HAVING COUNT(*) > 1
    ) sub
  `;
  const { rows } = await pool.query<{ dupes: number }>(sql);
  return rows[0]?.dupes ?? 0;
}

/**
 * I3b — distribución de pending coexistiendo por cadena.
 * Cadenas con 8-31 pending suelen ser diarias dentro de la ventana del cron (sano).
 * Cadenas con >100 pending coexistiendo son bagaje injectado.
 */
async function getPendingCountDistribution(tenant: string): Promise<PendingCountBucketRow[]> {
  const sql = `
    SELECT
      pending_count::int AS pending_count,
      COUNT(*)::int      AS chains
    FROM (
      SELECT "assetId", "operationId", COUNT(*) AS pending_count
      FROM "${tenant}"."operationRecords"
      WHERE "startDate" IS NULL
      GROUP BY "assetId", "operationId"
    ) sub
    GROUP BY pending_count
    ORDER BY pending_count
  `;
  const { rows } = await pool.query<PendingCountBucketRow>(sql);
  return rows;
}

export async function getI3Refinement(tenant: string): Promise<I3RefinementResult> {
  if (!(await tenantExists(tenant))) {
    throw new Error(`Unknown or invalid tenant: ${tenant}`);
  }
  const [strict, dist] = await Promise.all([
    getStrictTripleDuplicates(tenant),
    getPendingCountDistribution(tenant),
  ]);
  return {
    strict_triple_duplicates: strict,
    pending_count_distribution: dist,
  };
}

/**
 * Cuántas cadenas violan AL MENOS UNA de I3/I5/I6 (unión, no suma — una cadena patológica suele
 * acumular las 3 violaciones). chains_healthy = total - violators. I4 se excluye deliberadamente
 * por ser caso raro que no cambia la foto.
 */
export async function getHealthyChainsBreakdown(tenant: string): Promise<HealthyChainsResult> {
  if (!(await tenantExists(tenant))) {
    throw new Error(`Unknown or invalid tenant: ${tenant}`);
  }
  const sql = `
    WITH all_chains AS (
      SELECT DISTINCT "assetId", "operationId"
      FROM "${tenant}"."operationRecords"
    ),
    violators AS (
      -- I3: cadenas con 2+ pending
      SELECT "assetId", "operationId"
      FROM "${tenant}"."operationRecords"
      WHERE "startDate" IS NULL
      GROUP BY "assetId", "operationId"
      HAVING COUNT(*) > 1

      UNION

      -- I6: cadenas con pending en activos jubilados
      SELECT opr."assetId", opr."operationId"
      FROM "${tenant}"."operationRecords" opr
      JOIN "${tenant}".assets a ON a.id = opr."assetId"
      WHERE opr."startDate" IS NULL
        AND a.deregistered = true

      UNION

      -- I5: cadenas con pending sin contrato vigente cubriendo centro+clase+tipo+fecha
      SELECT opr."assetId", opr."operationId"
      FROM "${tenant}"."operationRecords" opr
      JOIN "${tenant}".assets a ON a.id = opr."assetId"
      JOIN "${tenant}".rooms r ON r.id = a."roomId"
      JOIN "${tenant}".floors fl ON fl.id = r."floorId"
      JOIN admin.operations op ON op.id = opr."operationId"
      JOIN admin."assetSubtypes" asub ON asub.id = op."assetSubtypeId"
      JOIN admin."assetTypes" atyp ON atyp.id = asub."assetTypeId"
      WHERE opr."startDate" IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "${tenant}".contracts c
          JOIN "${tenant}"."contractMaintenanceClasses" cmc ON cmc."contractId" = c.id
          JOIN "${tenant}"."contractMaintenanceTypes"   cmt ON cmt."contractId" = c.id
          WHERE c."centerId"             = fl."centerId"
            AND cmc."maintenanceClassId" = atyp."maintenanceClassId"
            AND cmt."maintenanceTypeId"  = op."maintenanceTypeId"
            AND c."initDate"            <= opr."originalScheduledDate"
            AND (c."finishDate" IS NULL OR c."finishDate" > opr."originalScheduledDate")
        )
    )
    SELECT
      (SELECT COUNT(*) FROM all_chains)::int                                  AS total_chains,
      (SELECT COUNT(*) FROM violators)::int                                   AS chains_violating_any,
      ((SELECT COUNT(*) FROM all_chains) - (SELECT COUNT(*) FROM violators))::int AS chains_healthy
  `;
  const { rows } = await pool.query<HealthyChainsResult>(sql);
  return rows[0];
}

export async function runHealthCheck(tenant: string): Promise<HealthCheckResult> {
  if (!(await tenantExists(tenant))) {
    throw new Error(`Unknown or invalid tenant: ${tenant}`);
  }
  const [total, multi, ooo, uncov, dereg] = await Promise.all([
    getTotalChains(tenant),
    getMultiplePending(tenant),
    getOutOfOrderPending(tenant),
    getUncoveredPending(tenant),
    getDeregisteredPending(tenant),
  ]);
  return {
    total_chains: total,
    chains_with_multiple_pending: multi,
    chains_with_out_of_order_pending: ooo,
    chains_with_uncovered_pending: uncov,
    chains_pending_in_deregistered_assets: dereg,
  };
}
