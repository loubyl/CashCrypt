// Shared static art data for the house layers (ViewBox units, 800 by 600).
// Colors are CSS variables (design-system tokens) or constants of the scene config.
// Every irregular-looking value is deterministic: it comes from a fixed table or from a
// hash of a stable key, scaled by the level's `wonk` (near 0 at level 1, 1 at level 5).
import { CHIMNEY_BOX, unitFromId } from "@/lib/scene";
import type { LevelFeatures, Point } from "@/lib/scene";

export const TOKEN = {
  void: "var(--surface-void)",
  card: "var(--surface-card)",
  raised: "var(--surface-raised)",
  overlay: "var(--surface-overlay)",
  candle: "var(--accent-candle)",
  spirit: "var(--accent-spirit)",
  ghost: "var(--accent-ghost)",
  tertiary: "var(--text-tertiary)",
  ink: "var(--text-primary)",
} as const;

/** Ids of the SVG filters and patterns defined once per scene in <defs> (unique per mounted scene). */
export type SceneFilterIds = { halo: string; moon: string; shingles: string };

export function makeFilterIds(rawId: string): SceneFilterIds {
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  return { halo: `scene-halo-${id}`, moon: `scene-moon-halo-${id}`, shingles: `scene-shingles-${id}` };
}

export const HALO_BLUR = 7;
export const MOON_BLUR = 9;
/** Scalloped shingle tile (pattern units). */
export const SHINGLE_TILE = { w: 14, h: 9 } as const;
export const SHINGLE_OPACITY = 0.55;

/** Overlay opacity of the decay tint on the slate walls (subtle). */
export const TINT_OVERLAY_OPACITY = 0.1;
/** Level 1 walls get a light veil, level 5 a dark one; 0 elsewhere. */
export const WALL_LIGHT_VEIL: Readonly<Record<number, number>> = { 1: 0.04 };
export const WALL_DARK_VEIL: Readonly<Record<number, number>> = {};

export const GROUND_Y = 400;

// ---------------------------------------------------------------------------
// House volumes: a tall narrow tower between two lower wings
// ---------------------------------------------------------------------------

/** Wing walls (below the hip roofs) and the band they span together. */
export const WING_LEFT = { x: 200, y: 212, w: 138, h: GROUND_Y - 212 } as const;
export const WING_RIGHT = { x: 462, y: 212, w: 138, h: GROUND_Y - 212 } as const;
/** Kept for the exposed beams and the ground strip: the full width of the wings. */
export const WALLS = { x: 200, y: 212, w: 400, h: GROUND_Y - 212 } as const;
/** Central tower walls, taller and narrower than each wing. */
export const TOWER = { x: 338, y: 154, w: 124, h: GROUND_Y - 154 } as const;
export const TOWER_CENTER_X = TOWER.x + TOWER.w / 2;

export const MOON = { cx: 96, cy: 92, r: 28 } as const;
export const MOON_HALO_RADIUS = 44;

/** Gable wall inside the tower roof, and its broken top at level 5. */
export const GABLE_WALL = "342,154 400,58 458,154";
export const GABLE_WALL_COLLAPSED = "342,154 350,96 376,86 400,70 426,84 450,98 458,154";
/** Gable roof as a thick inverted V with overhanging eaves. */
export const GABLE_ROOF = "320,158 400,28 480,158 458,158 400,58 342,158";
export const GABLE_ROOF_OUTER = "320,158 400,28 480,158";
export const LEFT_HIP = "184,216 226,170 342,170 342,216";
export const RIGHT_HIP = "616,216 574,170 458,170 458,216";
export const RIGHT_HIP_PARTIAL = "616,216 598,198 586,208 568,184 542,202 522,194 458,206 458,216";
export const LEFT_HIP_COLLAPSED = "184,216 210,198 240,210 270,200 300,212 342,216";
export const RIGHT_HIP_COLLAPSED = "616,216 590,200 560,210 530,200 500,212 458,216";
export const STUMP_LEFT = "320,158 354,108 366,128 342,158";
export const STUMP_RIGHT = "480,158 446,114 434,132 458,158";
/** Eave lines of the three roofs (x from, x to, y), for trims and shadow bands. */
export const EAVES: readonly { x1: number; x2: number; y: number }[] = [
  { x1: 184, x2: 342, y: 212 },
  { x1: 458, x2: 616, y: 212 },
];

/** Chimney body runs below its visible box so the roof hides the joint. */
export const CHIMNEY_BODY = {
  x: CHIMNEY_BOX.x,
  y: CHIMNEY_BOX.y,
  w: CHIMNEY_BOX.w,
  h: CHIMNEY_BOX.h + 30,
} as const;
/** Smoke puffs above the chimney (local offsets from the chimney top center). */
export const SMOKE_PUFFS: readonly { dx: number; dy: number; r: number; opacity: number }[] = [
  { dx: 6, dy: -14, r: 7, opacity: 0.34 },
  { dx: 16, dy: -32, r: 10, opacity: 0.26 },
  { dx: 30, dy: -54, r: 13, opacity: 0.18 },
];
/** Puffs shown per level: a lived-in chimney smokes; the condemned house barely does. */
export const SMOKE_PUFFS_BY_LEVEL: Readonly<Record<number, number>> = { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1 };

const LEAN_DEG = -2;
const LEAN_PIVOT_X = 400;

/** Transform of the house, decay and windows layers (leaning walls at level 5). */
export function getStructureTransform(features: Pick<LevelFeatures, "structure">): string | undefined {
  return features.structure === "collapsing"
    ? `rotate(${LEAN_DEG} ${LEAN_PIVOT_X} ${GROUND_Y})`
    : undefined;
}

// ---------------------------------------------------------------------------
// Wonkiness: small deterministic irregularities that grow with decay
// ---------------------------------------------------------------------------

const WONK_SALT = "wonk";
const SIGNED_SCALE = 2;
const SIGNED_SHIFT = 1;

/** A stable value in [-1, 1) for a part key. */
export function signedUnit(key: string): number {
  return unitFromId(key, WONK_SALT) * SIGNED_SCALE - SIGNED_SHIFT;
}

/** Offset of one part: up to `max` units (or degrees) in either direction, scaled by `wonk`. */
export function wonkOffset(key: string, wonk: number, max: number): number {
  return signedUnit(key) * max * wonk;
}

/** Maximum offsets at wonk 1. */
export const WONK_MAX = {
  wallCorner: 7,
  wingTopSlope: 5,
  hipRotateDeg: 3,
  gableRotateDeg: 2,
  windowRotateDeg: 5,
  chimneyRotateDeg: 7,
  picketHeight: 14,
  picketRotateDeg: 12,
} as const;

/** Quadrilateral of a wall rectangle whose top corners move by the level's wonk. */
export function wonkyWallPoints(
  box: { x: number; y: number; w: number; h: number },
  key: string,
  wonk: number,
): string {
  const left = box.x + wonkOffset(`${key}:tl`, wonk, WONK_MAX.wallCorner);
  const right = box.x + box.w + wonkOffset(`${key}:tr`, wonk, WONK_MAX.wallCorner);
  const topLeft = box.y + Math.abs(wonkOffset(`${key}:sl`, wonk, WONK_MAX.wingTopSlope));
  const topRight = box.y + Math.abs(wonkOffset(`${key}:sr`, wonk, WONK_MAX.wingTopSlope));
  const bottom = box.y + box.h;
  return `${left},${topLeft} ${right},${topRight} ${box.x + box.w},${bottom} ${box.x},${bottom}`;
}

// ---------------------------------------------------------------------------
// Tapered curved strokes (trunks and branches)
// ---------------------------------------------------------------------------

const TAPER_SAMPLES = 10;

/**
 * Closed path of a quadratic curve from `start` to `end` (control `control`) whose width
 * tapers from `startWidth` to `endWidth`. Used for tree trunks and branches.
 */
export function taperedPath(
  start: Point,
  control: Point,
  end: Point,
  startWidth: number,
  endWidth: number,
): string {
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= TAPER_SAMPLES; i += 1) {
    const t = i / TAPER_SAMPLES;
    const u = 1 - t;
    const x = u * u * start.x + 2 * u * t * control.x + t * t * end.x;
    const y = u * u * start.y + 2 * u * t * control.y + t * t * end.y;
    const dx = 2 * u * (control.x - start.x) + 2 * t * (end.x - control.x);
    const dy = 2 * u * (control.y - start.y) + 2 * t * (end.y - control.y);
    const length = Math.hypot(dx, dy) || 1;
    const half = (startWidth + (endWidth - startWidth) * t) / 2;
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    left.push(`${(x + nx).toFixed(1)} ${(y + ny).toFixed(1)}`);
    right.push(`${(x - nx).toFixed(1)} ${(y - ny).toFixed(1)}`);
  }
  return `M${left.join(" L")} L${right.reverse().join(" L")} Z`;
}

/** One limb of a tree, in the tree's local space (trunk base at x 0, ground y 400). */
export type Limb = { start: Point; control: Point; end: Point; w0: number; w1: number };

export const TREE_TRUNK: Limb = { start: { x: 0, y: 400 }, control: { x: 6, y: 340 }, end: { x: -4, y: 268 }, w0: 15, w1: 6 };
export const TREE_TRUNK_TWISTED: Limb = { start: { x: 0, y: 400 }, control: { x: -26, y: 330 }, end: { x: 4, y: 262 }, w0: 15, w1: 6 };
/** Branches of a bare tree, thick near the trunk and thin at the tips. */
export const TREE_LIMBS: readonly Limb[] = [
  { start: { x: 2, y: 336 }, control: { x: -26, y: 326 }, end: { x: -46, y: 292 }, w0: 7, w1: 1.5 },
  { start: { x: -36, y: 306 }, control: { x: -50, y: 300 }, end: { x: -62, y: 304 }, w0: 3, w1: 1 },
  { start: { x: 3, y: 316 }, control: { x: 30, y: 308 }, end: { x: 44, y: 276 }, w0: 6, w1: 1.5 },
  { start: { x: 34, y: 290 }, control: { x: 48, y: 286 }, end: { x: 58, y: 292 }, w0: 2.5, w1: 1 },
  { start: { x: -2, y: 290 }, control: { x: -20, y: 274 }, end: { x: -24, y: 250 }, w0: 5, w1: 1.2 },
  { start: { x: -3, y: 272 }, control: { x: 12, y: 250 }, end: { x: 26, y: 238 }, w0: 4, w1: 1 },
];
/** Extra crooked limbs of the twisted and charred trees. */
export const TREE_LIMBS_TWISTED: readonly Limb[] = [
  { start: { x: -8, y: 318 }, control: { x: -44, y: 320 }, end: { x: -58, y: 280 }, w0: 7, w1: 1.5 },
  { start: { x: -48, y: 296 }, control: { x: -70, y: 290 }, end: { x: -76, y: 270 }, w0: 3, w1: 1 },
  { start: { x: -10, y: 296 }, control: { x: 30, y: 300 }, end: { x: 40, y: 262 }, w0: 6, w1: 1.5 },
  { start: { x: 0, y: 266 }, control: { x: -26, y: 250 }, end: { x: -18, y: 226 }, w0: 4, w1: 1 },
  { start: { x: 2, y: 266 }, control: { x: 22, y: 254 }, end: { x: 34, y: 232 }, w0: 3.5, w1: 1 },
];

// ---------------------------------------------------------------------------
// Decay marks (placed on the new walls, clear of the windows)
// ---------------------------------------------------------------------------

export const CRACK_PATHS: readonly string[] = [
  "M212 222 L222 254 L208 284 L219 320",
  "M586 222 L577 256 L590 284 L580 322",
  "M350 246 L361 266 L348 284 L357 302",
  "M588 336 L578 358 L590 380 L582 396",
];

export const STAINS: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 262, cy: 392, rx: 40, ry: 10 },
  { cx: 536, cy: 394, rx: 48, ry: 10 },
  { cx: 452, cy: 392, rx: 22, ry: 8 },
];

/** On the tower, right of the upper window and above the porch roof (clear of lantern and porch). */
export const PLASTER_HOLE = "436,250 456,246 459,270 448,288 436,278";

export const FOG_BARS: readonly { x: number; y: number; w: number }[] = [
  { x: 40, y: 350, w: 320 },
  { x: 470, y: 322, w: 300 },
  { x: 120, y: 380, w: 380 },
  { x: 560, y: 296, w: 220 },
];
/** Levels 4 and 5 replace the third bar (it crossed door and porch) by two short bars beside the door (door x 370..430, porch x 342..458). */
export const FOG_DOOR_BAR_INDEX = 2;
export const FOG_DOOR_CLEAR_BARS: readonly { x: number; y: number; w: number }[] = [
  { x: 110, y: 380, w: 220 },
  { x: 470, y: 380, w: 140 },
];
export const FOG_DOOR_CLEAR_MIN_LEVEL = 4;
export const FOG_BAR_HEIGHT = 14;
export const FOG_BACK_BARS = 2;
export const FOG_OPACITY = 0.3;
export const FOG_FRONT_OPACITY = 0.2;

/** Large soft mint mounds behind the house (ellipses), as in the reference. */
export const FOG_MOUNDS: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 138, cy: 388, rx: 122, ry: 72 },
  { cx: 248, cy: 394, rx: 78, ry: 46 },
  { cx: 662, cy: 384, rx: 112, ry: 78 },
  { cx: 752, cy: 394, rx: 70, ry: 48 },
];
export const FOG_MOUND_BASE_OPACITY = 0.1;
export const FOG_MOUND_STEP_OPACITY = 0.035;

/** Bats keep clear of the Poltergeist (left of the tower) and the chimney smoke. */
export const BATS: readonly { x: number; y: number }[] = [
  { x: 690, y: 64 },
  { x: 744, y: 150 },
  { x: 504, y: 40 },
];
export const BAT_PATH = "M-16 -4 Q-8 -12 0 -2 Q8 -12 16 -4 Q10 0 8 6 Q4 2 0 6 Q-4 2 -8 6 Q-10 0 -16 -4Z";

export const FIREFLIES: readonly { x: number; y: number }[] = [
  { x: 150, y: 300 },
  { x: 660, y: 250 },
  { x: 110, y: 360 },
  { x: 700, y: 330 },
  { x: 250, y: 130 },
];

export const STARS: readonly { x: number; y: number }[] = [
  { x: 40, y: 30 },
  { x: 176, y: 34 },
  { x: 300, y: 22 },
  { x: 620, y: 40 },
  { x: 700, y: 110 },
  { x: 760, y: 34 },
];

/** Irregular brick accents on the walls: x, y, width, height (rotation comes from a hash). */
export const BRICKS: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 350, y: 168, w: 18, h: 7 },
  { x: 436, y: 186, w: 14, h: 6 },
  { x: 446, y: 252, w: 16, h: 7 },
  { x: 214, y: 300, w: 15, h: 7 },
  { x: 226, y: 309, w: 10, h: 6 },
  { x: 312, y: 236, w: 18, h: 8 },
  { x: 568, y: 300, w: 17, h: 7 },
  { x: 476, y: 238, w: 12, h: 6 },
  { x: 352, y: 368, w: 14, h: 6 },
  { x: 444, y: 348, w: 18, h: 7 },
  { x: 584, y: 236, w: 9, h: 6 },
];
export const BRICK_RADIUS = 2.5;
export const BRICK_TILT_DEG = 4;

/** Foundation stones along the base of the walls (x, width); y and height are shared. */
export const FOUNDATION_STONES: readonly { x: number; w: number }[] = [
  { x: 200, w: 24 }, { x: 226, w: 18 }, { x: 246, w: 28 }, { x: 276, w: 20 }, { x: 298, w: 26 }, { x: 326, w: 12 },
  { x: 340, w: 22 }, { x: 446, w: 16 },
  { x: 462, w: 20 }, { x: 484, w: 28 }, { x: 514, w: 18 }, { x: 534, w: 26 }, { x: 562, w: 20 }, { x: 584, w: 16 },
];
export const FOUNDATION_Y = 386;
export const FOUNDATION_H = 9;

/** Grass tufts along the ground line (x of each tuft base). */
export const TUFTS: readonly number[] = [76, 158, 262, 332, 468, 540, 596, 700, 762];
export const TUFT_PATH = "M-5 0 L-3 -9 L0 -3 L2 -11 L4 -3 L7 -8 L6 0 Z";

/** Two lumpy bushes at the house corners: clusters of uneven blobs. */
export const BUSHES: readonly { cx: number; cy: number; r: number }[] = [
  { cx: 214, cy: 394, r: 11 },
  { cx: 228, cy: 386, r: 15 },
  { cx: 246, cy: 390, r: 13 },
  { cx: 262, cy: 395, r: 9 },
  { cx: 236, cy: 396, r: 10 },
  { cx: 544, cy: 395, r: 10 },
  { cx: 560, cy: 387, r: 14 },
  { cx: 578, cy: 389, r: 12 },
  { cx: 592, cy: 395, r: 9 },
  { cx: 568, cy: 397, r: 9 },
];

/** Moonlight edge of level 5: open polylines along the top edges of the collapsed roof, gable and chimney. */
export const MOON_EDGE_POLYLINES: readonly string[] = [
  LEFT_HIP_COLLAPSED,
  RIGHT_HIP_COLLAPSED,
  "320,158 354,108 366,128",
  "480,158 446,114 434,132",
  GABLE_WALL_COLLAPSED,
];

/** x of the left and right tree trunks. */
export const TREE_LEFT_X = 118;
export const TREE_RIGHT_X = 688;

/** Fence pickets (x) with pointed tops, and the ones missing when broken. */
export const FENCE_POSTS: readonly number[] = [626, 642, 658, 674, 690, 706, 722, 738];
export const FENCE_MISSING: readonly number[] = [658, 722];
export const FENCE_PICKET = { w: 5, h: 34, tip: 6 } as const;

/** Equality of small plain-data props, so memoized creature figures skip re-render when the model is rebuilt with equal data. */
export function isSameData<T extends Record<string, unknown>>(previous: T, next: T): boolean {
  return JSON.stringify(previous) === JSON.stringify(next);
}

/**
 * Hides decorative atmosphere (fog bars, fireflies, bats) under Reduced_Motion without any script:
 * the media query covers first paint, the scene container's data-motion attribute covers a live flip.
 */
export const REDUCED_MOTION_HIDE_CLASS = "motion-reduce:hidden group-data-[motion=reduced]/scene:hidden";
