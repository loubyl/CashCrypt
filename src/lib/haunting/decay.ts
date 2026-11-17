// Maps a light score to the display-layer values: decay level, progress inside
// the level's band, and window brightness. All boundaries come from config.ts.

import {
  BAND_L1_MIN,
  BAND_L2_MIN,
  BAND_L3_MIN,
  BAND_L4_MIN,
  BAND_L5_MIN,
  SCORE_MAX,
  SCORE_MIN,
} from "./config";
import type { DecayLevel } from "./types";

// Lower band boundaries ordered from level 1 (index 0) to level 5 (index 4).
const BAND_MINS: readonly number[] = [BAND_L1_MIN, BAND_L2_MIN, BAND_L3_MIN, BAND_L4_MIN, BAND_L5_MIN];

const LAST_BAND_INDEX = BAND_MINS.length - 1;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

// NaN is treated as the minimum score; infinities clamp to the bounds.
function clampScore(lightScore: number): number {
  if (Number.isNaN(lightScore)) return SCORE_MIN;
  return clamp(lightScore, SCORE_MIN, SCORE_MAX);
}

function levelToIndex(level: DecayLevel): number {
  return clamp(level - 1, 0, LAST_BAND_INDEX);
}

/** Half-open bands: [L1_MIN, SCORE_MAX] → 1, [L2_MIN, L1_MIN) → 2, ... [L5_MIN, L4_MIN) → 5. */
export function computeDecayLevel(lightScore: number): DecayLevel {
  const score = clampScore(lightScore);
  const index = BAND_MINS.findIndex((bandMin) => score >= bandMin);
  return (index === -1 ? LAST_BAND_INDEX + 1 : index + 1) as DecayLevel;
}

/** Position inside the level's band, in [0, 1]. Level 1 includes SCORE_MAX. */
export function computeLevelProgress(lightScore: number, level: DecayLevel): number {
  const score = clampScore(lightScore);
  const index = levelToIndex(level);
  const bandLow = BAND_MINS[index];
  const bandHigh = index === 0 ? SCORE_MAX : BAND_MINS[index - 1];
  const width = bandHigh - bandLow;
  if (!(width > 0)) return 0;
  return clamp((score - bandLow) / width, 0, 1);
}

/** lightScore / SCORE_MAX, clamped to [0, 1]. */
export function computeWindowBrightness(lightScore: number): number {
  return clamp(clampScore(lightScore) / SCORE_MAX, 0, 1);
}
