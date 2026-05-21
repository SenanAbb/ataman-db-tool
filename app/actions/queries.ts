'use server';

import {
  getInventorySummary,
  getYearDistribution,
  getFrequencyDistribution,
} from '@/lib/queries/inventory';
import {
  getExecutionStatus,
  getSeedStatus,
  getBagaje,
  getTopChains,
  getExtremeDates,
} from '@/lib/queries/bagaje';
import {
  getPendingMonthly,
  getRecentBatchSummary,
  getCronVsSeeds,
  getChainSeedHealth,
} from '@/lib/queries/diagnostic';
import {
  runHealthCheck,
  getHealthyChainsBreakdown,
  getI3Refinement,
} from '@/lib/queries/health-check';
import type {
  InventorySummary,
  YearBucketRow,
  FrequencyRow,
  ExecutionStatusRow,
  SeedStatusRow,
  BagajeRow,
  TopChainRow,
  ExtremeDateRow,
  PendingMonthlyRow,
  RecentBatchSummary,
  CronVsSeedsResult,
  ChainSeedHealth,
  HealthCheckResult,
  HealthyChainsResult,
  I3RefinementResult,
} from '@/lib/types';

export interface ActionResult<T> {
  data?: T;
  error?: string;
  elapsed_ms: number;
}

async function wrap<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  const started = Date.now();
  try {
    const data = await fn();
    return { data, elapsed_ms: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, elapsed_ms: Date.now() - started };
  }
}

export async function loadInventorySummary(tenant: string): Promise<ActionResult<InventorySummary>> {
  return wrap(() => getInventorySummary(tenant));
}
export async function loadYearDistribution(tenant: string): Promise<ActionResult<YearBucketRow[]>> {
  return wrap(() => getYearDistribution(tenant));
}
export async function loadFrequencyDistribution(tenant: string): Promise<ActionResult<FrequencyRow[]>> {
  return wrap(() => getFrequencyDistribution(tenant));
}
export async function loadExecutionStatus(tenant: string): Promise<ActionResult<ExecutionStatusRow[]>> {
  return wrap(() => getExecutionStatus(tenant));
}
export async function loadSeedStatus(tenant: string): Promise<ActionResult<SeedStatusRow[]>> {
  return wrap(() => getSeedStatus(tenant));
}
export async function loadBagaje(tenant: string): Promise<ActionResult<BagajeRow[]>> {
  return wrap(() => getBagaje(tenant));
}
export async function loadTopChains(
  tenant: string,
  page: number,
  pageSize: number,
): Promise<ActionResult<TopChainRow[]>> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.min(Math.floor(pageSize), 200));
  return wrap(() => getTopChains(tenant, { limit: safeSize, offset: (safePage - 1) * safeSize }));
}
export async function loadExtremeDates(tenant: string): Promise<ActionResult<ExtremeDateRow[]>> {
  return wrap(() => getExtremeDates(tenant));
}
export async function loadPendingMonthly(tenant: string): Promise<ActionResult<PendingMonthlyRow[]>> {
  return wrap(() => getPendingMonthly(tenant));
}
export async function loadRecentBatchSummary(
  tenant: string,
  batchSize: number,
): Promise<ActionResult<RecentBatchSummary>> {
  return wrap(() => getRecentBatchSummary(tenant, batchSize));
}
export async function loadCronVsSeeds(
  tenant: string,
  batchSize: number,
): Promise<ActionResult<CronVsSeedsResult>> {
  return wrap(() => getCronVsSeeds(tenant, batchSize));
}
export async function loadChainSeedHealth(tenant: string): Promise<ActionResult<ChainSeedHealth>> {
  return wrap(() => getChainSeedHealth(tenant));
}
export async function loadHealthCheck(tenant: string): Promise<ActionResult<HealthCheckResult>> {
  return wrap(() => runHealthCheck(tenant));
}
export async function loadHealthyChainsBreakdown(
  tenant: string,
): Promise<ActionResult<HealthyChainsResult>> {
  return wrap(() => getHealthyChainsBreakdown(tenant));
}
export async function loadI3Refinement(
  tenant: string,
): Promise<ActionResult<I3RefinementResult>> {
  return wrap(() => getI3Refinement(tenant));
}
