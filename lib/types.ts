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

export interface PendingMonthlyRow {
  month: string;
  pending_count: number;
}

export interface RecentBatchSummary {
  batch_size: number;
  min_id: number | null;
  max_id: number | null;
  min_osd: string | null;
  max_osd: string | null;
  pending: number;
  executed: number;
}

export interface CronVsSeedsResult {
  batch_size: number;
  cron_recent_batch: number;
  son_seed: number;
  no_son_seed: number;
}

export interface ChainSeedHealth {
  chains_total: number;
  chains_recent_seed_7d: number;
  chains_stale_seed_7d: number;
  chains_future_seed: number;
}

export interface HealthCheckResult {
  total_chains: number;
  chains_with_multiple_pending: number;
  chains_with_out_of_order_pending: number;
  chains_with_uncovered_pending: number;
  chains_pending_in_deregistered_assets: number;
}

export interface HealthyChainsResult {
  total_chains: number;
  chains_violating_any: number;
  chains_healthy: number;
}

export interface PendingCountBucketRow {
  pending_count: number;
  chains: number;
}

export interface I3RefinementResult {
  strict_triple_duplicates: number;
  pending_count_distribution: PendingCountBucketRow[];
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
