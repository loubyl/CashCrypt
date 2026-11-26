// Window layout, window state assignment, opacity curve and payment flare steps.
// Pure module: no React, GSAP, DOM, clock or random source.

import type { DecayLevel } from "@/lib/haunting/config";
import {
  OPACITY_FLOOR_BY_LEVEL,
  WINDOW_BOXES,
  WINDOW_COUNT,
  WINDOW_FAILURE_ORDER,
  WINDOW_SHAPES,
  windowOpacityFromFloors,
} from "./config";
import type { Box, LevelFeatures, WindowShape, WindowState } from "./types";

export type WindowSlot = { index: number; shape: WindowShape; box: Box };

/**
 * Fixed layout in ViewBox units (800 by 600). The house is a tall central tower
 * (x 338..462, walls from y 154, gable apex y 28) between two lower wings
 * (x 200..338 and 462..600, walls from y 212). Indices 0 and 2 are the upper wing
 * windows, 1 the upper tower window above the porch, 3 and 4 the ground-floor wing
 * windows, 5 the round attic window inside the gable. All boxes sit inside their wall
 * or the gable, and clear of the chimney box and the Poltergeist.
 */
export const WINDOW_LAYOUT: readonly WindowSlot[] = WINDOW_BOXES.map((box, index) => ({
  index,
  shape: WINDOW_SHAPES[index],
  box,
}));

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
