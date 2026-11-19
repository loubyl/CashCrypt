// Every number and key used by the exorcism planner lives here.

export const PLAN_SIZE = 3;
export const USAGE_WEIGHTS = { never: 1.0, rarely: 0.6, often: 0.2 } as const;
export const EXTRA_PAYMENT_INCOME_BASIS_POINTS = 1000; // 10%
export const EMERGENCY_FUND_INCOME_BASIS_POINTS = 500; // 5%
export const BASIS_POINTS_DENOMINATOR = 10000;
export const CENTS_PER_WHOLE_DOLLAR = 100;
export const MONTHS_PER_YEAR_FOR_INTEREST = 12;
export const FLOAT_NOISE_EPSILON = 1e-9;
export const FALLBACK_KEYS = [
  "emergency-fund",
  "review-small-expenses",
  "review-subscriptions",
] as const;

export type FallbackKey = (typeof FALLBACK_KEYS)[number];
