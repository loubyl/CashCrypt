// Scene_Config: every constant of the house scene, plus validateSceneConfig.
// Pure module: no React, GSAP, DOM, clock or random source. It imports only
// types and band boundaries from the haunting engine config.
//
// Import-cycle note: validateSceneConfig needs the window opacity curve and the
// feature table. Both are defined here (windowOpacityFromFloors, LEVEL_FEATURES);
// windows.ts and features.ts import from this module and never the reverse.

import {
  BAND_L1_MIN,
  BAND_L2_MIN,
  BAND_L3_MIN,
  BAND_L4_MIN,
  BAND_L5_MIN,
} from "@/lib/haunting/config";
import type { DecayLevel } from "@/lib/haunting/config";
import type { Box, LevelFeatures, Point } from "./types";

// ---------------------------------------------------------------------------
// ViewBox
// ---------------------------------------------------------------------------

export const VIEWBOX_WIDTH = 800;
export const VIEWBOX_HEIGHT = 600;
export const REFERENCE_WIDTH_PX = 560;
export const UNITS_PER_REFERENCE_PX = VIEWBOX_WIDTH / REFERENCE_WIDTH_PX;

// ---------------------------------------------------------------------------
// Caps
// ---------------------------------------------------------------------------

export const MAX_VISIBLE_ZOMBIES = 6;
export const MAX_VISIBLE_GHOSTS = 12;
export const MAX_VISIBLE_TOMBSTONES = 6;

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

export const WINDOW_COUNT = 6;
export const WINDOW_FAILURE_ORDER: readonly number[] = [3, 1, 4, 0, 5, 2];
export const MIN_VISIBLE_WINDOW_DELTA = 0.15;
export const OPACITY_FLOOR_BY_LEVEL: Readonly<Record<DecayLevel, number>> = {
  1: 0.8,
  2: 0.6,
  3: 0.4,
  4: 0.02,
  5: 0,
};
export const PAYMENT_FLARE_BOOST = 0.35;

/** Lower band boundaries of the decay levels on the 0..1 brightness scale. */
const SCORE_SCALE = 100;
export const BAND_MIN_BRIGHTNESS: Readonly<Record<DecayLevel, number>> = {
  1: BAND_L1_MIN / SCORE_SCALE,
  2: BAND_L2_MIN / SCORE_SCALE,
  3: BAND_L3_MIN / SCORE_SCALE,
  4: BAND_L4_MIN / SCORE_SCALE,
  5: BAND_L5_MIN / SCORE_SCALE,
};

/** Reference brightness pair of Requirement 7.6 (the demo step from level 4 to level 3). */
export const DEMO_STEP_LEVEL_BEFORE: DecayLevel = 4;
export const DEMO_STEP_BRIGHTNESS_BEFORE = 0.327;
export const DEMO_STEP_LEVEL_AFTER: DecayLevel = 3;
export const DEMO_STEP_BRIGHTNESS_AFTER = 0.43;

// ---------------------------------------------------------------------------
// Sizes (ViewBox units)
// ---------------------------------------------------------------------------

export const ZOMBIE_HEIGHT_MIN = 46;
export const ZOMBIE_HEIGHT_MAX = 114;
export const ZOMBIE_WIDTH_RATIO = 0.625;
export const ZOMBIE_FULL_RATIO = 0.1;
export const GHOST_SIZE_MIN = 34;
export const GHOST_SIZE_MAX = 80;
export const POLTERGEIST_SIZE = 171;
export const POLTERGEIST_CENTER: Readonly<Point> = { x: 400, y: 150 };
export const SIGIL_DIAMETER = 262;
export const SIGIL_STROKE = 4;
export const SIGIL_GLOW_PAD = 8;
export const SIGIL_SHAKE = 6;
export const SIGIL_MIN_RATIO = 1.5;
export const BADGE_SIZE = 24;
export const CHIMNEY_BOX: Readonly<Box> = { x: 555, y: 105, w: 40, h: 60 };

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const BASEMENT_BAND: Readonly<Box> = { x: 60, y: 400, w: 680, h: 120 };
export const ZOMBIE_BASELINE_Y = 515;
export const GRAVEYARD_BAND: Readonly<Box> = { x: 60, y: 520, w: 680, h: 70 };
export const TOMBSTONE_BOX_WIDTH = 64;
export const TOMBSTONE_BOX_HEIGHT = 56;
export const TOMBSTONE_BASELINE_Y = 585;
export const ZOMBIE_SLOT_UNITS = BASEMENT_BAND.w / MAX_VISIBLE_ZOMBIES;
export const TOMBSTONE_SLOT_UNITS = GRAVEYARD_BAND.w / MAX_VISIBLE_TOMBSTONES;

export type GhostLaneConfig = { cx: number; cy: number; rx: number; ry: number };
export const GHOST_LANES: readonly GhostLaneConfig[] = [
  { cx: 400, cy: 250, rx: 320, ry: 140 },
  { cx: 400, cy: 300, rx: 280, ry: 110 },
  { cx: 400, cy: 200, rx: 340, ry: 90 },
];

// ---------------------------------------------------------------------------
// Moment art (ViewBox units unless noted)
// ---------------------------------------------------------------------------

export const SHOVEL_HEIGHT = 180;
export const SHOVEL_BOUND_RADIUS = 100;
export const SHOVEL_START: Readonly<Point> = { x: 700, y: 140 };
export const BAT_HALF_SIZE = 20;
export const BAT_START: Readonly<Point> = { x: 520, y: 70 };
export const BAT_END: Readonly<Point> = { x: 750, y: 40 };
export const ZOMBIE_SINK_SCALE = 1.4;
export const ZOMBIE_SINK_CLIP: Readonly<Box> = { x: 60, y: 340, w: 680, h: 180 };
export const TOMBSTONE_CLIP: Readonly<Box> = { x: 60, y: 520, w: 680, h: 70 };
export const CANDLE_BOX: Readonly<{ w: number; h: number }> = { w: 24, h: 80 };
export const CANDLE_ROW_ORIGIN: Readonly<Point> = { x: 60, y: 40 };
export const CANDLE_SPACING = 60;
export const SHUTTER_WIDTH = 24;
/** Screen pixels of art drawn in the HTML Moment_Layer. */
export const FLAME_PX = 32;
export const ORB_PX = 28;

// ---------------------------------------------------------------------------
// Motion data
// ---------------------------------------------------------------------------

export const ZOMBIE_TILT_DEG = 5;
export const ZOMBIE_SWAY_AMPLITUDE_PX = 3;
export const ZOMBIE_SWAY_PERIOD_MIN_MS = 3000;
export const ZOMBIE_SWAY_PERIOD_MAX_MS = 5000;
export const GHOST_BOB_AMPLITUDE_PX = 6;
export const GHOST_BOB_PERIOD_MIN_MS = 2500;
export const GHOST_BOB_PERIOD_MAX_MS = 3500;
export const GHOST_SPAWN_MS = 300;
export const LEVEL_TRANSITION_MS = 1200;
export const WINDOW_INTERPOLATION_MS = 600;
export const POLTERGEIST_PULSE_MS = 1500;
export const POLTERGEIST_ROTATION_MS = 8000;

// ---------------------------------------------------------------------------
// Moments (durations equal the design-system.md moment catalog)
// ---------------------------------------------------------------------------

export type MomentDurationKey =
  | "cancel"
  | "payment"
  | "sigil"
  | "levelBetter"
  | "levelWorse"
  | "exorcismComplete";

export const MOMENT_DURATION_MS: Readonly<Record<MomentDurationKey, number>> = {
  cancel: 1400,
  payment: 1200,
  sigil: 1200,
  levelBetter: 1600,
  levelWorse: 1000,
  exorcismComplete: 1200,
};
export const MOMENT_MIN_DURATION_MS = 600;
export const MOMENT_HARD_CAP_MS = 2500;
export const MOMENT_INPUT_UNBLOCK_MS = 300;
export const MOMENT_GAP_MS = 200;
export const MOMENT_BEAT_MIN_MS = 300;
export const MOMENT_QUEUE_MAX_PENDING = 4;
export const REDUCED_MOTION_FADE_MS = 150;
export const SETTLE_TIMEOUT_MS = 800;

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const MIN_SCENE_WIDTH_DESKTOP_PX = 480;
export const MIN_LABEL_PX = 12;
export const TOMBSTONE_LABEL_MIN_SLOT_PX = 64;
export const TOMBSTONE_LABEL_MIN_SCENE_WIDTH_PX = Math.ceil(
  (TOMBSTONE_LABEL_MIN_SLOT_PX * VIEWBOX_WIDTH) / TOMBSTONE_SLOT_UNITS,
);

// ---------------------------------------------------------------------------
// Scene-only colors (the only hex values in this module)
// ---------------------------------------------------------------------------

export const DECAY_TINTS: Readonly<Record<DecayLevel, string>> = {
  1: "#F5EFC8",
  2: "#F0E0A0",
  3: "#C89040",
  4: "#A05030",
  5: "#200810",
};
export const ZOMBIE_BODY = "#4A6B3A";
export const ZOMBIE_CLOTHING = "#2E4A24";
/** Roof and tree color (style reference: house-reference-1.jpg). */
export const SCENE_TEAL = "#29464A";
/** Ground line and trim color. */
export const SCENE_TEAL_LIGHT = "#395F60";
/** Fog bars, always drawn at low opacity. */
export const SCENE_FOG = "#B7D4CF";

// ---------------------------------------------------------------------------
// Feature table (see design "Decay levels")
// ---------------------------------------------------------------------------

export const LEVEL_FEATURES: Readonly<Record<DecayLevel, LevelFeatures>> = {
  1: {
    crackCount: 0, stainCount: 0, plasterHole: false,
    boardedWindows: 0, brokenWindows: 0,
    roof: "intact", moss: false, garden: "green", lantern: "lit",
    tree: "none", fence: "intact", structure: "sound",
    fog: 0, bats: false, fireflies: true, shadowPass: false, darkness: 0,
  },
  2: {
    crackCount: 1, stainCount: 0, plasterHole: false,
    boardedWindows: 0, brokenWindows: 0,
    roof: "missingShingles", moss: false, garden: "browning", lantern: "dim",
    tree: "none", fence: "intact", structure: "sound",
    fog: 1, bats: false, fireflies: false, shadowPass: false, darkness: 0.05,
  },
  3: {
    crackCount: 2, stainCount: 1, plasterHole: false,
    boardedWindows: 1, brokenWindows: 0,
    roof: "sagging", moss: true, garden: "dead", lantern: "unlit",
    tree: "none", fence: "intact", structure: "sound",
    fog: 2, bats: false, fireflies: false, shadowPass: true, darkness: 0.15,
  },
  4: {
    crackCount: 3, stainCount: 2, plasterHole: true,
    boardedWindows: 2, brokenWindows: 1,
    roof: "partialCollapse", moss: true, garden: "bare", lantern: "unlit",
    tree: "bare", fence: "broken", structure: "sound",
    fog: 3, bats: true, fireflies: false, shadowPass: true, darkness: 0.35,
  },
  5: {
    crackCount: 4, stainCount: 3, plasterHole: true,
    boardedWindows: 3, brokenWindows: 3,
    roof: "collapsed", moss: true, garden: "scorched", lantern: "unlit",
    tree: "charred", fence: "broken", structure: "collapsing",
    fog: 4, bats: true, fireflies: false, shadowPass: false, darkness: 0.8,
  },
};

const ROOF_ORDER = ["intact", "missingShingles", "sagging", "partialCollapse", "collapsed"];
const GARDEN_ORDER = ["green", "browning", "dead", "bare", "scorched"];
const LANTERN_ORDER = ["lit", "dim", "unlit"];
const TREE_ORDER = ["none", "bare", "charred"];
const FENCE_ORDER = ["intact", "broken"];
const STRUCTURE_ORDER = ["sound", "collapsing"];

/** Keys that distinguish two levels (all features, including the ambient flags). */
const DISTINCTION_KEYS: readonly (keyof LevelFeatures)[] = [
  "crackCount", "stainCount", "plasterHole", "boardedWindows", "brokenWindows",
  "roof", "moss", "garden", "lantern", "tree", "fence", "structure",
  "fog", "bats", "fireflies", "shadowPass", "darkness",
];

/**
 * Ordinal severity of each monotone feature. `fireflies` and `shadowPass` are
 * ambient flags and are excluded. An unknown enum value yields -1.
 */
export function featureSeverity(features: LevelFeatures): number[] {
  return [
    features.crackCount,
    features.stainCount,
    Number(features.plasterHole),
    features.boardedWindows + features.brokenWindows,
    ROOF_ORDER.indexOf(features.roof),
    Number(features.moss),
    GARDEN_ORDER.indexOf(features.garden),
    LANTERN_ORDER.indexOf(features.lantern),
    TREE_ORDER.indexOf(features.tree),
    FENCE_ORDER.indexOf(features.fence),
    STRUCTURE_ORDER.indexOf(features.structure),
    features.fog,
    Number(features.bats),
    features.darkness,
  ];
}

// ---------------------------------------------------------------------------
// Window opacity curve (pure; windows.ts delegates here)
// ---------------------------------------------------------------------------

export const DECAY_LEVELS: readonly DecayLevel[] = [1, 2, 3, 4, 5];
const WORST_LEVEL: DecayLevel = 5;
const BEST_LEVEL: DecayLevel = 1;
const UNIT_MIN = 0;
const UNIT_MAX = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Piecewise linear candlelight opacity of one level. The floor of level L is
 * the opacity at the bottom of its band; the top is the floor of level L - 1
 * (1 for level 1). Level 5 is always 0.
 */
export function windowOpacityFromFloors(
  floors: Readonly<Record<DecayLevel, number>>,
  level: DecayLevel,
  brightness: number,
): number {
  if (level === WORST_LEVEL) return UNIT_MIN;
  const b = clamp(finiteOrZero(brightness), UNIT_MIN, UNIT_MAX);
  const low = floors[level];
  const high = level === BEST_LEVEL ? UNIT_MAX : floors[(level - 1) as DecayLevel];
  const bandMin = BAND_MIN_BRIGHTNESS[level];
  const bandMax = level === BEST_LEVEL ? UNIT_MAX : BAND_MIN_BRIGHTNESS[(level - 1) as DecayLevel];
  const t = clamp((b - bandMin) / (bandMax - bandMin), UNIT_MIN, UNIT_MAX);
  return clamp(low + t * (high - low), UNIT_MIN, UNIT_MAX);
}

// ---------------------------------------------------------------------------
// SceneConfig and SCENE_CONFIG
// ---------------------------------------------------------------------------

export type SceneConfig = {
  VIEWBOX_WIDTH: number;
  VIEWBOX_HEIGHT: number;
  REFERENCE_WIDTH_PX: number;
  UNITS_PER_REFERENCE_PX: number;
  MAX_VISIBLE_ZOMBIES: number;
  MAX_VISIBLE_GHOSTS: number;
  MAX_VISIBLE_TOMBSTONES: number;
  WINDOW_COUNT: number;
  WINDOW_FAILURE_ORDER: readonly number[];
  MIN_VISIBLE_WINDOW_DELTA: number;
  OPACITY_FLOOR_BY_LEVEL: Readonly<Record<DecayLevel, number>>;
  PAYMENT_FLARE_BOOST: number;
  ZOMBIE_HEIGHT_MIN: number;
  ZOMBIE_HEIGHT_MAX: number;
  ZOMBIE_WIDTH_RATIO: number;
  ZOMBIE_FULL_RATIO: number;
  GHOST_SIZE_MIN: number;
  GHOST_SIZE_MAX: number;
  POLTERGEIST_SIZE: number;
  POLTERGEIST_CENTER: Readonly<Point>;
  SIGIL_DIAMETER: number;
  SIGIL_STROKE: number;
  SIGIL_GLOW_PAD: number;
  SIGIL_SHAKE: number;
  BADGE_SIZE: number;
  CHIMNEY_BOX: Readonly<Box>;
  BASEMENT_BAND: Readonly<Box>;
  ZOMBIE_BASELINE_Y: number;
  GRAVEYARD_BAND: Readonly<Box>;
  TOMBSTONE_BOX_WIDTH: number;
  TOMBSTONE_BOX_HEIGHT: number;
  TOMBSTONE_BASELINE_Y: number;
  GHOST_LANES: readonly GhostLaneConfig[];
  SHOVEL_HEIGHT: number;
  SHOVEL_BOUND_RADIUS: number;
  SHOVEL_START: Readonly<Point>;
  BAT_HALF_SIZE: number;
  BAT_START: Readonly<Point>;
  BAT_END: Readonly<Point>;
  ZOMBIE_SINK_SCALE: number;
  ZOMBIE_SINK_CLIP: Readonly<Box>;
  TOMBSTONE_CLIP: Readonly<Box>;
  CANDLE_BOX: Readonly<{ w: number; h: number }>;
  CANDLE_ROW_ORIGIN: Readonly<Point>;
  CANDLE_SPACING: number;
  SHUTTER_WIDTH: number;
  FLAME_PX: number;
  ORB_PX: number;
  MOMENT_DURATION_MS: Readonly<Record<MomentDurationKey, number>>;
  MOMENT_HARD_CAP_MS: number;
  MOMENT_INPUT_UNBLOCK_MS: number;
  MOMENT_GAP_MS: number;
  MOMENT_BEAT_MIN_MS: number;
  MOMENT_QUEUE_MAX_PENDING: number;
  REDUCED_MOTION_FADE_MS: number;
  SETTLE_TIMEOUT_MS: number;
  MIN_SCENE_WIDTH_DESKTOP_PX: number;
  MIN_LABEL_PX: number;
  TOMBSTONE_LABEL_MIN_SLOT_PX: number;
  DECAY_TINTS: Readonly<Record<DecayLevel, string>>;
  ZOMBIE_BODY: string;
  ZOMBIE_CLOTHING: string;
  SCENE_TEAL: string;
  SCENE_TEAL_LIGHT: string;
  SCENE_FOG: string;
  LEVEL_FEATURES: Readonly<Record<DecayLevel, LevelFeatures>>;
};

export const SCENE_CONFIG: SceneConfig = {
  VIEWBOX_WIDTH,
  VIEWBOX_HEIGHT,
  REFERENCE_WIDTH_PX,
  UNITS_PER_REFERENCE_PX,
  MAX_VISIBLE_ZOMBIES,
  MAX_VISIBLE_GHOSTS,
  MAX_VISIBLE_TOMBSTONES,
  WINDOW_COUNT,
  WINDOW_FAILURE_ORDER,
  MIN_VISIBLE_WINDOW_DELTA,
  OPACITY_FLOOR_BY_LEVEL,
  PAYMENT_FLARE_BOOST,
  ZOMBIE_HEIGHT_MIN,
  ZOMBIE_HEIGHT_MAX,
  ZOMBIE_WIDTH_RATIO,
  ZOMBIE_FULL_RATIO,
  GHOST_SIZE_MIN,
  GHOST_SIZE_MAX,
  POLTERGEIST_SIZE,
  POLTERGEIST_CENTER,
  SIGIL_DIAMETER,
  SIGIL_STROKE,
  SIGIL_GLOW_PAD,
  SIGIL_SHAKE,
  BADGE_SIZE,
  CHIMNEY_BOX,
  BASEMENT_BAND,
  ZOMBIE_BASELINE_Y,
  GRAVEYARD_BAND,
  TOMBSTONE_BOX_WIDTH,
  TOMBSTONE_BOX_HEIGHT,
  TOMBSTONE_BASELINE_Y,
  GHOST_LANES,
  SHOVEL_HEIGHT,
  SHOVEL_BOUND_RADIUS,
  SHOVEL_START,
  BAT_HALF_SIZE,
  BAT_START,
  BAT_END,
  ZOMBIE_SINK_SCALE,
  ZOMBIE_SINK_CLIP,
  TOMBSTONE_CLIP,
  CANDLE_BOX,
  CANDLE_ROW_ORIGIN,
  CANDLE_SPACING,
  SHUTTER_WIDTH,
  FLAME_PX,
  ORB_PX,
  MOMENT_DURATION_MS,
  MOMENT_HARD_CAP_MS,
  MOMENT_INPUT_UNBLOCK_MS,
  MOMENT_GAP_MS,
  MOMENT_BEAT_MIN_MS,
  MOMENT_QUEUE_MAX_PENDING,
  REDUCED_MOTION_FADE_MS,
  SETTLE_TIMEOUT_MS,
  MIN_SCENE_WIDTH_DESKTOP_PX,
  MIN_LABEL_PX,
  TOMBSTONE_LABEL_MIN_SLOT_PX,
  DECAY_TINTS,
  ZOMBIE_BODY,
  ZOMBIE_CLOTHING,
  SCENE_TEAL,
  SCENE_TEAL_LIGHT,
  SCENE_FOG,
  LEVEL_FEATURES,
};

// ---------------------------------------------------------------------------
// Sigil geometry
// ---------------------------------------------------------------------------

/** Outer extent of the sigil: stroke, glow padding and (horizontally) the shake offset. */
export function getSigilExtent(
  center: Point,
  diameter: number,
  stroke: number,
  glowPad: number,
  shake: number,
): { left: number; right: number; top: number; bottom: number } {
  const half = diameter / 2;
  const reach = half + stroke / 2 + glowPad;
  return {
    left: center.x - reach - shake,
    right: center.x + reach + shake,
    top: center.y - reach,
    bottom: center.y + reach,
  };
}

// ---------------------------------------------------------------------------
// validateSceneConfig
// ---------------------------------------------------------------------------

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MOMENT_KEYS: readonly MomentDurationKey[] = [
  "cancel", "payment", "sigil", "levelBetter", "levelWorse", "exorcismComplete",
];

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntAtLeast(value: unknown, min: number): value is number {
  return isNum(value) && Number.isInteger(value) && value >= min;
}

function asPoint(value: unknown): Point | null {
  return isObj(value) && isNum(value.x) && isNum(value.y) ? { x: value.x, y: value.y } : null;
}

function asBox(value: unknown): Box | null {
  return isObj(value) && isNum(value.x) && isNum(value.y) && isNum(value.w) && isNum(value.h)
    ? { x: value.x, y: value.y, w: value.w, h: value.h }
    : null;
}

function asFloors(value: unknown): Record<DecayLevel, number> | null {
  if (!isObj(value)) return null;
  const result = {} as Record<DecayLevel, number>;
  for (const level of DECAY_LEVELS) {
    const entry = value[String(level)];
    if (!isNum(entry)) return null;
    result[level] = entry;
  }
  return result;
}

function boxInside(box: Box, width: number, height: number): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.w <= width && box.y + box.h <= height;
}

function checkCaps(c: Obj, problems: string[]): void {
  for (const key of ["MAX_VISIBLE_ZOMBIES", "MAX_VISIBLE_GHOSTS", "MAX_VISIBLE_TOMBSTONES", "WINDOW_COUNT"]) {
    if (!isIntAtLeast(c[key], 1)) problems.push(`${key} must be an integer of at least 1`);
  }
  for (const key of ["MOMENT_QUEUE_MAX_PENDING"]) {
    if (!isIntAtLeast(c[key], 1)) problems.push(`${key} must be an integer of at least 1`);
  }
}

function checkViewBox(c: Obj, problems: string[]): void {
  for (const key of ["VIEWBOX_WIDTH", "VIEWBOX_HEIGHT", "REFERENCE_WIDTH_PX"]) {
    const value = c[key];
    if (!isNum(value) || value <= 0) problems.push(`${key} must be a positive finite number`);
  }
}

function checkMoments(c: Obj, problems: string[]): void {
  const cap = c.MOMENT_HARD_CAP_MS;
  const unblock = c.MOMENT_INPUT_UNBLOCK_MS;
  if (!isNum(cap) || cap <= 0) problems.push("MOMENT_HARD_CAP_MS must be a positive finite number");
  if (!isNum(unblock) || unblock < 0) problems.push("MOMENT_INPUT_UNBLOCK_MS must be a non-negative finite number");
  for (const key of ["MOMENT_GAP_MS", "MOMENT_BEAT_MIN_MS", "REDUCED_MOTION_FADE_MS", "SETTLE_TIMEOUT_MS"]) {
    const value = c[key];
    if (!isNum(value) || value < 0) problems.push(`${key} must be a non-negative finite number`);
  }
  const durations = c.MOMENT_DURATION_MS;
  if (!isObj(durations)) {
    problems.push("MOMENT_DURATION_MS must be an object");
    return;
  }
  for (const key of MOMENT_KEYS) {
    const value = durations[key];
    if (!isNum(value)) {
      problems.push(`MOMENT_DURATION_MS.${key} must be a finite number`);
      continue;
    }
    if (value < MOMENT_MIN_DURATION_MS || (isNum(cap) && value > cap)) {
      problems.push(`MOMENT_DURATION_MS.${key} must be between ${MOMENT_MIN_DURATION_MS} and MOMENT_HARD_CAP_MS`);
    }
    if (isNum(unblock) && unblock >= value) {
      problems.push(`MOMENT_INPUT_UNBLOCK_MS must be below MOMENT_DURATION_MS.${key}`);
    }
  }
}

function checkWindowCurve(c: Obj, problems: string[]): void {
  const order = c.WINDOW_FAILURE_ORDER;
  const count = c.WINDOW_COUNT;
  if (!Array.isArray(order) || !isIntAtLeast(count, 1)) {
    problems.push("WINDOW_FAILURE_ORDER must be an array with one entry per window");
  } else {
    const valid =
      order.length === count &&
      new Set(order).size === count &&
      order.every((v) => isIntAtLeast(v, 0) && v < count);
    if (!valid) problems.push("WINDOW_FAILURE_ORDER must be a permutation of 0..WINDOW_COUNT-1");
  }
  const delta = c.MIN_VISIBLE_WINDOW_DELTA;
  if (!isNum(delta) || delta < 0) problems.push("MIN_VISIBLE_WINDOW_DELTA must be a non-negative finite number");
  const boost = c.PAYMENT_FLARE_BOOST;
  if (!isNum(boost) || boost <= 0 || boost > 1) {
    problems.push("PAYMENT_FLARE_BOOST must be a finite number above 0 and at most 1");
  }
  const floors = asFloors(c.OPACITY_FLOOR_BY_LEVEL);
  if (!floors) {
    problems.push("OPACITY_FLOOR_BY_LEVEL must have a finite number for each level 1 to 5");
    return;
  }
  let floorsOk = true;
  for (const level of DECAY_LEVELS) {
    if (floors[level] < 0 || floors[level] > 1) {
      floorsOk = false;
      problems.push(`OPACITY_FLOOR_BY_LEVEL[${level}] must be in 0 to 1`);
    }
    if (level > BEST_LEVEL && floors[level] > floors[(level - 1) as DecayLevel]) {
      floorsOk = false;
      problems.push(`OPACITY_FLOOR_BY_LEVEL must not increase from level ${level - 1} to level ${level}`);
    }
  }
  if (!floorsOk) return;
  checkCurveOutputs(floors, delta, problems);
}

function checkCurveOutputs(
  floors: Record<DecayLevel, number>,
  delta: unknown,
  problems: string[],
): void {
  for (const level of DECAY_LEVELS) {
    for (const b of [UNIT_MIN, BAND_MIN_BRIGHTNESS[level], UNIT_MAX]) {
      const opacity = windowOpacityFromFloors(floors, level, b);
      if (!(opacity >= UNIT_MIN && opacity <= UNIT_MAX)) {
        problems.push(`window opacity at level ${level} must stay in 0 to 1`);
        return;
      }
    }
  }
  if (!isNum(delta)) return;
  const better = windowOpacityFromFloors(floors, DEMO_STEP_LEVEL_AFTER, DEMO_STEP_BRIGHTNESS_AFTER);
  const worse = windowOpacityFromFloors(floors, DEMO_STEP_LEVEL_BEFORE, DEMO_STEP_BRIGHTNESS_BEFORE);
  if (better - worse < delta) {
    problems.push("window opacity step from level 4 (0.327) to level 3 (0.43) must be at least MIN_VISIBLE_WINDOW_DELTA");
  }
}

function checkFeatureTable(c: Obj, problems: string[]): void {
  const table = c.LEVEL_FEATURES;
  if (!isObj(table)) {
    problems.push("LEVEL_FEATURES must be an object with one entry per level");
    return;
  }
  const levels: LevelFeatures[] = [];
  for (const level of DECAY_LEVELS) {
    const entry = table[String(level)];
    if (!isObj(entry)) {
      problems.push(`LEVEL_FEATURES[${level}] must be an object`);
      return;
    }
    levels.push(entry as unknown as LevelFeatures);
  }
  const severities = levels.map(featureSeverity);
  if (severities.some((vector) => vector.some((n) => !isNum(n) || n < 0))) {
    problems.push("LEVEL_FEATURES contains an unknown or negative value");
    return;
  }
  for (let i = 1; i < severities.length; i += 1) {
    const worse = severities[i];
    const better = severities[i - 1];
    if (worse.some((n, k) => n < better[k])) {
      problems.push(`LEVEL_FEATURES severity must not decrease from level ${i} to level ${i + 1}`);
    }
  }
  for (let a = 0; a < levels.length; a += 1) {
    for (let b = a + 1; b < levels.length; b += 1) {
      if (DISTINCTION_KEYS.every((key) => levels[a][key] === levels[b][key])) {
        problems.push(`LEVEL_FEATURES levels ${a + 1} and ${b + 1} must differ in at least one feature`);
      }
    }
  }
}

function checkSizes(c: Obj, problems: string[]): void {
  const pairs: [string, string][] = [
    ["ZOMBIE_HEIGHT_MIN", "ZOMBIE_HEIGHT_MAX"],
    ["GHOST_SIZE_MIN", "GHOST_SIZE_MAX"],
  ];
  for (const [min, max] of pairs) {
    const lo = c[min];
    const hi = c[max];
    if (!isNum(lo) || !isNum(hi) || lo <= 0 || lo > hi) {
      problems.push(`${min} must be positive and at most ${max}`);
    }
  }
  for (const key of ["ZOMBIE_WIDTH_RATIO", "ZOMBIE_FULL_RATIO", "POLTERGEIST_SIZE", "BADGE_SIZE"]) {
    const value = c[key];
    if (!isNum(value) || value <= 0) problems.push(`${key} must be a positive finite number`);
  }
}

function checkSigil(c: Obj, problems: string[]): void {
  const center = asPoint(c.POLTERGEIST_CENTER);
  const chimney = asBox(c.CHIMNEY_BOX);
  const { SIGIL_DIAMETER: d, SIGIL_STROKE: s, SIGIL_GLOW_PAD: g, SIGIL_SHAKE: k } = c;
  const size = c.POLTERGEIST_SIZE;
  const width = c.VIEWBOX_WIDTH;
  const height = c.VIEWBOX_HEIGHT;
  if (!center) problems.push("POLTERGEIST_CENTER must be a point with finite x and y");
  if (!chimney) problems.push("CHIMNEY_BOX must be a box with finite x, y, w and h");
  if (!isNum(d) || d <= 0) problems.push("SIGIL_DIAMETER must be a positive finite number");
  for (const [name, value] of [["SIGIL_STROKE", s], ["SIGIL_GLOW_PAD", g], ["SIGIL_SHAKE", k]] as const) {
    if (!isNum(value) || value < 0) problems.push(`${name} must be a non-negative finite number`);
  }
  if (!center || !chimney || !isNum(d) || !isNum(s) || !isNum(g) || !isNum(k)) return;
  if (isNum(size) && d < SIGIL_MIN_RATIO * size) {
    problems.push("SIGIL_DIAMETER must be at least 1.5 times POLTERGEIST_SIZE");
  }
  const extent = getSigilExtent(center, d, s, g, k);
  if (isNum(width) && isNum(height) && (extent.left < 0 || extent.right > width || extent.top < 0 || extent.bottom > height)) {
    problems.push("the sigil, with stroke, glow padding and shake, must lie inside the ViewBox");
  }
  const overlaps =
    extent.left < chimney.x + chimney.w &&
    extent.right > chimney.x &&
    extent.top < chimney.y + chimney.h &&
    extent.bottom > chimney.y;
  if (overlaps) problems.push("the sigil must not intersect the chimney box");
}

function checkMomentArt(c: Obj, problems: string[]): void {
  const width = c.VIEWBOX_WIDTH;
  const height = c.VIEWBOX_HEIGHT;
  if (!isNum(width) || !isNum(height)) return;
  for (const key of ["ZOMBIE_SINK_CLIP", "TOMBSTONE_CLIP", "BASEMENT_BAND", "GRAVEYARD_BAND"]) {
    const box = asBox(c[key]);
    if (!box || !boxInside(box, width, height)) problems.push(`${key} must be a box inside the ViewBox`);
  }
  for (const key of ["SHOVEL_START", "BAT_START", "BAT_END", "CANDLE_ROW_ORIGIN"]) {
    const p = asPoint(c[key]);
    if (!p || p.x < 0 || p.y < 0 || p.x > width || p.y > height) {
      problems.push(`${key} must be a point inside the ViewBox`);
    }
  }
  for (const key of ["SHOVEL_HEIGHT", "SHOVEL_BOUND_RADIUS", "BAT_HALF_SIZE", "ZOMBIE_SINK_SCALE", "SHUTTER_WIDTH", "CANDLE_SPACING", "FLAME_PX", "ORB_PX"]) {
    const value = c[key];
    if (!isNum(value) || value <= 0) problems.push(`${key} must be a positive finite number`);
  }
}

function checkLabelsAndColors(c: Obj, problems: string[]): void {
  for (const key of ["MIN_SCENE_WIDTH_DESKTOP_PX", "MIN_LABEL_PX", "TOMBSTONE_LABEL_MIN_SLOT_PX"]) {
    const value = c[key];
    if (!isNum(value) || value <= 0) problems.push(`${key} must be a positive finite number`);
  }
  const tints = c.DECAY_TINTS;
  for (const level of DECAY_LEVELS) {
    if (!isObj(tints) || typeof tints[String(level)] !== "string" || !HEX_COLOR.test(tints[String(level)] as string)) {
      problems.push(`DECAY_TINTS[${level}] must be a #RRGGBB color`);
    }
  }
  for (const key of ["ZOMBIE_BODY", "ZOMBIE_CLOTHING", "SCENE_TEAL", "SCENE_TEAL_LIGHT", "SCENE_FOG"]) {
    const value = c[key];
    if (typeof value !== "string" || !HEX_COLOR.test(value)) problems.push(`${key} must be a #RRGGBB color`);
  }
  const lanes = c.GHOST_LANES;
  if (!Array.isArray(lanes) || lanes.length === 0 || !lanes.every((l) => isObj(l) && isNum(l.cx) && isNum(l.cy) && isNum(l.rx) && isNum(l.ry))) {
    problems.push("GHOST_LANES must be a non-empty list of lanes with finite cx, cy, rx and ry");
  }
}

/** Returns the list of problems of a config. Never throws. */
export function validateSceneConfig(config: unknown): string[] {
  if (!isObj(config)) return ["config must be an object"];
  const problems: string[] = [];
  try {
    checkCaps(config, problems);
    checkViewBox(config, problems);
    checkMoments(config, problems);
    checkWindowCurve(config, problems);
    checkFeatureTable(config, problems);
    checkSizes(config, problems);
    checkSigil(config, problems);
    checkMomentArt(config, problems);
    checkLabelsAndColors(config, problems);
  } catch (error) {
    problems.push(`config could not be validated: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  return problems;
}
