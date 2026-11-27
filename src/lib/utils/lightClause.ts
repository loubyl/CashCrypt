// Pure text rule for the light effect of a Mutation. No React, Dexie, Next.js or clock.
import { formatCentsShort } from "./cents";

/** Float noise from re-summing equal data; a real change is never this small. */
export const LIGHT_NOISE_EPSILON = 1e-9;
export const LIGHT_FULL_SCORE = 100;
export const CLAUSE_SEPARATOR = " \u00b7 ";
export const MINUS_SIGN = "\u2212";
export const GHOST_EXPENSE_CLAUSE = "feeds the Poltergeist, doesn't dim the light";
export const GHOST_WOKE_CLAUSE = "woke the Poltergeist, doesn't dim the light";
export const GHOST_ASLEEP_CLAUSE = "doesn't dim the light";
export const EXPENSE_CLAUSE = "doesn't change the light";
/** Clause of the toast for a ticked fallback action: it adds no momentum (Requirement 17.2). */
export const FALLBACK_CLAUSE = EXPENSE_CLAUSE;
const WAKES_SUFFIX = "more wakes the Poltergeist";

const LIGHT_UNCHANGED = "Light unchanged";
const LIGHT_ALREADY_FULL = "Light already full";
const LIGHT_RISES_SLIGHTLY = "Light rises slightly";
const LIGHT_DIMS_SLIGHTLY = "Light dims slightly";
const TENTH_FACTOR = 10;
const CLAUSE_DECIMALS = 1;

/** Returns the clause that states how a Mutation changed the light score. */
export function getLightClause(before: number, after: number): string {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return LIGHT_UNCHANGED;
  const delta = after - before;
  const size = Math.abs(delta);
  if (size < LIGHT_NOISE_EPSILON) {
    return before >= LIGHT_FULL_SCORE - LIGHT_NOISE_EPSILON ? LIGHT_ALREADY_FULL : LIGHT_UNCHANGED;
  }
  // Half away from zero, applied to the absolute value.
  const rounded = Math.round(size * TENTH_FACTOR) / TENTH_FACTOR;
  if (rounded === 0) return delta > 0 ? LIGHT_RISES_SLIGHTLY : LIGHT_DIMS_SLIGHTLY;
  const sign = delta > 0 ? "+" : MINUS_SIGN;
  return `Light ${sign}${rounded.toFixed(CLAUSE_DECIMALS)}`;
}

/** What a small expense did to the Poltergeist: fed it, woke it, or found it asleep (or gone). */
export type PoltergeistStage = "awake" | "woke" | "asleep";

/** The one rule shared by the ghost toast and the Moment planning. */
export function getPoltergeistStage(before: boolean, after: boolean): PoltergeistStage {
  if (!after) return "asleep";
  return before ? "awake" : "woke";
}

export type GhostClauseInput = {
  poltergeistBefore: boolean;
  poltergeistAfter: boolean;
  centsToWake: number | null;
};

/** Returns the clause of the toast for a small expense. Never claims a Poltergeist that is not there. */
export function getGhostClause(change: GhostClauseInput | null | undefined): string {
  if (!change) return GHOST_ASLEEP_CLAUSE;
  const stage = getPoltergeistStage(change.poltergeistBefore, change.poltergeistAfter);
  if (stage === "awake") return GHOST_EXPENSE_CLAUSE;
  if (stage === "woke") return GHOST_WOKE_CLAUSE;
  if (change.centsToWake === null) return GHOST_ASLEEP_CLAUSE;
  return `${GHOST_ASLEEP_CLAUSE}${CLAUSE_SEPARATOR}${formatCentsShort(change.centsToWake)} ${WAKES_SUFFIX}`;
}

/** Joins a base toast text and an optional clause. */
export function joinToastText(base: string, clause: string | null): string {
  return clause === null ? base : `${base}${CLAUSE_SEPARATOR}${clause}`;
}
