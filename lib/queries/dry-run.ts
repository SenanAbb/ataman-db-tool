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
