// Pure score presentation helpers for the Dashboard. No React, no Dexie.

import type { DecayLevel } from "@/lib/haunting/config";
import { getDeltaPresentation } from "./delta";
import type { DeltaDirection, DeltaIntent } from "./delta";
import { clampScore } from "./score";

const LEVEL_NAMES: Record<DecayLevel, string> = {
  1: "Pristine",
  2: "Uneasy",
  3: "Haunted",
  4: "Crumbling",
  5: "Condemned",
};
const LEVEL_SEPARATOR = "—";
const DELTA_SUFFIX = "this week";

export type ScoreDelta = {
  direction: DeltaDirection;
  intent: DeltaIntent;
  text: string;
};

function displayedScore(score: number): number {
  return Math.floor(clampScore(score));
}

/**
 * Difference between the displayed (floored) current and start scores.
 * Null when the displayed values are equal.
 */
export function getScoreDelta(currentScore: number, startScore: number): ScoreDelta | null {
  const difference = displayedScore(currentScore) - displayedScore(startScore);
  if (difference === 0) {
    return null;
  }
  const direction: DeltaDirection = difference > 0 ? "up" : "down";
  const intent: DeltaIntent = difference > 0 ? "good" : "bad";
  const { text } = getDeltaPresentation(direction, intent, `${Math.abs(difference)} ${DELTA_SUFFIX}`);
  return { direction, intent, text };
}

/** 4 → "Level 4 — Crumbling". */
export function getLevelLabel(level: DecayLevel): string {
  return `Level ${level} ${LEVEL_SEPARATOR} ${LEVEL_NAMES[level]}`;
}

/** (4, 28.6) → "House is now Crumbling — light score 28". */
export function getLevelAnnouncement(level: DecayLevel, score: number): string {
  return `House is now ${LEVEL_NAMES[level]} ${LEVEL_SEPARATOR} light score ${displayedScore(score)}`;
}
