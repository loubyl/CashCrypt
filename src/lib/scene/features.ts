// Per-level feature table accessor and severity helpers.
// Pure module: no React, GSAP, DOM, clock or random source.
// The table itself lives in config.ts (validateSceneConfig needs it, and
// config.ts must not import this file); it is re-exported here.

import type { DecayLevel } from "@/lib/haunting/config";
import { DECAY_LEVELS, LEVEL_FEATURES, featureSeverity } from "./config";
import type { LevelFeatures } from "./types";

export { LEVEL_FEATURES, featureSeverity };

const FIRST_LEVEL: DecayLevel = 1;
const LAST_LEVEL: DecayLevel = 5;

/** Features of a level. A level outside 1 to 5 (or not finite) is clamped; NaN becomes level 1. */
export function getLevelFeatures(level: number): LevelFeatures {
  if (!Number.isFinite(level)) return LEVEL_FEATURES[FIRST_LEVEL];
  const rounded = Math.round(level);
  const clamped = Math.min(LAST_LEVEL, Math.max(FIRST_LEVEL, rounded));
  return LEVEL_FEATURES[clamped as DecayLevel];
}

/** True when `worse` is at least as severe as `better` on every ordinal feature. */
export function isAtLeastAsSevere(worse: LevelFeatures, better: LevelFeatures): boolean {
  const a = featureSeverity(worse);
  const b = featureSeverity(better);
  return a.every((value, index) => value >= b[index]);
}

/** True when severity never decreases from level 1 to level 5 in the given table. */
export function isSeverityMonotone(table: Readonly<Record<DecayLevel, LevelFeatures>>): boolean {
  return DECAY_LEVELS.every(
    (level) => level === FIRST_LEVEL || isAtLeastAsSevere(table[level], table[(level - 1) as DecayLevel]),
  );
}
