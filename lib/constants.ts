export const DRY_RUN_DEFAULTS = {
  safety_cap: 10_000,
  backfill_max_age_value: 3,
  backfill_max_age_unit: 'days' as const,
};

export const DRY_RUN_LIMITS = {
  safety_cap_max: 1_000_000,
  backfill_max_age_value_max: 365,
};
