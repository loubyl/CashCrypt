// Scene summary text and level names.
// Pure module: no React, GSAP, DOM, clock or random source.

import type { DecayLevel } from "@/lib/haunting/config";
import type { PoltergeistState } from "./types";

export const LEVEL_NAMES: Readonly<Record<DecayLevel, string>> = {
  1: "Pristine",
  2: "Uneasy",
  3: "Haunted",
  4: "Crumbling",
  5: "Condemned",
};

const SINGULAR_COUNT = 1;
const NO_ITEMS = "no";
const POLTERGEIST_TEXT: Readonly<Record<PoltergeistState, string>> = {
  awake: "Poltergeist awake",
  bound: "Poltergeist bound",
};

export type SceneSummaryParts = {
  level: DecayLevel;
  levelName: string;
  /** True totals, not the drawn counts. */
  totals: { zombies: number; ghosts: number; tombstones: number };
  /** `null` when the engine reports no Poltergeist; the clause is then omitted. */
  poltergeist: PoltergeistState | null;
};

/** "4 zombies", "1 zombie" or "no zombies". */
function countPhrase(count: number, singular: string, plural: string): string {
  if (count === SINGULAR_COUNT) return `${count} ${singular}`;
  if (count > 0) return `${count} ${plural}`;
  return `${NO_ITEMS} ${plural}`;
}

/** Full summary, for example "Level 3, Haunted. 4 zombies, 30 ghosts, Poltergeist awake, 1 tombstone". */
export function buildSceneSummary(parts: SceneSummaryParts): string {
  const { level, levelName, totals, poltergeist } = parts;
  const clauses = [
    countPhrase(totals.zombies, "zombie", "zombies"),
    countPhrase(totals.ghosts, "ghost", "ghosts"),
    ...(poltergeist === null ? [] : [POLTERGEIST_TEXT[poltergeist]]),
    countPhrase(totals.tombstones, "tombstone", "tombstones"),
  ];
  return `Level ${level}, ${levelName}. ${clauses.join(", ")}`;
}
