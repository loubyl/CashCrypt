/** Lower bound of the Light Score. */
export const SCORE_MIN = 0;

/** Upper bound of the Light Score. */
export const SCORE_MAX = 100;

/**
 * Clamps a score into [SCORE_MIN, SCORE_MAX].
 * NaN becomes SCORE_MIN; ±Infinity are clamped to the bounds.
 */
export function clampScore(score: number): number {
  if (Number.isNaN(score)) return SCORE_MIN;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
}

/** Fill percentage for the score bar. Same as `clampScore`, kept separate for intent. */
export function getFillPercent(score: number): number {
  return clampScore(score);
}

/** Integer text shown for a score: the floor of the clamped value. */
export function formatScoreText(value: number): string {
  return String(Math.floor(clampScore(value)));
}

/** Breakdown text, e.g. "39 = 33 base + 6 momentum". Each part is floored. */
export function formatBreakdown(
  base: number,
  momentum: number,
  score: number,
): string {
  return `${Math.floor(score)} = ${Math.floor(base)} base + ${Math.floor(momentum)} momentum`;
}
