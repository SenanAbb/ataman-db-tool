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
