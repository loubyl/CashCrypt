// Scene summary text and level names.
// Pure module: no React, GSAP, DOM, clock or random source.

import type { DecayLevel } from "@/lib/haunting/config";

export const LEVEL_NAMES: Readonly<Record<DecayLevel, string>> = {
  1: "Pristine",
  2: "Uneasy",
  3: "Haunted",
  4: "Crumbling",
  5: "Condemned",
};

/** Level-aware summary, for example "Level 3, Haunted." */
export function buildSceneSummary(level: DecayLevel, levelName: string): string {
  return `Level ${level}, ${levelName}.`;
}
