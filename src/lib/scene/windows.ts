// Window layout, window state assignment, opacity curve and payment flare steps.
// Pure module: no React, GSAP, DOM, clock or random source.

import type { DecayLevel } from "@/lib/haunting/config";
import {
  OPACITY_FLOOR_BY_LEVEL,
  WINDOW_COUNT,
  WINDOW_FAILURE_ORDER,
  windowOpacityFromFloors,
} from "./config";
import type { Box, LevelFeatures, WindowShape, WindowState } from "./types";

export type WindowSlot = { index: number; shape: WindowShape; box: Box };

/**
 * Fixed layout in ViewBox units (800 by 600). Indices 0 to 2 are the upper
 * floor, 3 and 4 the ground floor flanking the door (door x 370..430), 5 the
 * round attic window. All boxes sit inside the walls (x 200..600, y 190..400)
 * or the roof gable, and clear of the chimney box.
 */
export const WINDOW_LAYOUT: readonly WindowSlot[] = [
  { index: 0, shape: "arched", box: { x: 244, y: 215, w: 56, h: 60 } },
  { index: 1, shape: "arched", box: { x: 372, y: 215, w: 56, h: 60 } },
  { index: 2, shape: "arched", box: { x: 500, y: 215, w: 56, h: 60 } },
  { index: 3, shape: "square", box: { x: 250, y: 310, w: 56, h: 60 } },
  { index: 4, shape: "square", box: { x: 494, y: 310, w: 56, h: 60 } },
  { index: 5, shape: "round", box: { x: 380, y: 146, w: 40, h: 40 } },
];

const UNIT_MIN = 0;
const UNIT_MAX = 1;

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clampUnit(value: number): number {
  return Math.min(UNIT_MAX, Math.max(UNIT_MIN, finiteOrZero(value)));
}

function toCount(value: number): number {
  const n = Math.floor(finiteOrZero(value));
  return Math.min(WINDOW_COUNT, Math.max(0, n));
}

/**
 * State of each window by index. Along WINDOW_FAILURE_ORDER the first
 * `brokenWindows` are broken, the next `boardedWindows` are boarded, the rest
 * are lit. Counts are clamped so that their sum never exceeds WINDOW_COUNT.
 */
export function assignWindowStates(
  features: Pick<LevelFeatures, "boardedWindows" | "brokenWindows">,
): WindowState[] {
  const states: WindowState[] = Array.from({ length: WINDOW_COUNT }, () => "lit");
  const broken = toCount(features.brokenWindows);
  const boarded = Math.min(toCount(features.boardedWindows), WINDOW_COUNT - broken);
  WINDOW_FAILURE_ORDER.forEach((windowIndex, rank) => {
    if (rank < broken) states[windowIndex] = "broken";
    else if (rank < broken + boarded) states[windowIndex] = "boarded";
  });
  return states;
}

/** Candlelight opacity (0 to 1) of a lit window at a level and engine window brightness. */
export function getWindowOpacity(level: DecayLevel, brightness: number): number {
  return windowOpacityFromFloors(OPACITY_FLOOR_BY_LEVEL, level, brightness);
}

export type FlareSteps = { from: number; peak: number; final: number };

/**
 * Payment flare: `from` the frozen opacity, up to `peak`, then settle on the
 * live value. peak = min(1, live + boost) and is never below live. Non-finite
 * inputs count as 0; everything is clamped to 0..1.
 */
export function getFlareSteps(previous: number, live: number, boost: number): FlareSteps {
  const from = clampUnit(previous);
  const final = clampUnit(live);
  const lift = Math.max(0, finiteOrZero(boost));
  const peak = Math.max(final, Math.min(UNIT_MAX, final + lift));
  return { from, peak, final };
}
