// Shared static art data for the house layers (ViewBox units, 800 by 600).
// Colors are CSS variables (design-system tokens) or constants of the scene config.

import { CHIMNEY_BOX } from "@/lib/scene";
import type { LevelFeatures } from "@/lib/scene";

export const TOKEN = {
  void: "var(--surface-void)",
  card: "var(--surface-card)",
  raised: "var(--surface-raised)",
  overlay: "var(--surface-overlay)",
  candle: "var(--accent-candle)",
  spirit: "var(--accent-spirit)",
  tertiary: "var(--text-tertiary)",
} as const;

export const WALLS = { x: 200, y: 190, w: 400, h: 210 } as const;
export const GROUND_Y = 400;
export const MOON = { cx: 110, cy: 100, r: 28 } as const;

export const GABLE_WALL = "320,196 400,84 480,196";
export const GABLE_WALL_COLLAPSED = "320,196 340,140 372,150 400,110 430,150 462,138 480,196";
export const GABLE_ROOF = "296,196 400,52 504,196 480,196 400,84 320,196";
export const LEFT_HIP = "184,204 226,164 318,164 296,196 296,204";
export const RIGHT_HIP = "616,204 574,164 482,164 504,196 504,204";
export const RIGHT_HIP_PARTIAL = "616,204 596,186 584,196 566,172 540,190 520,182 504,196 504,204";
export const LEFT_HIP_COLLAPSED = "184,204 210,190 240,200 270,192 296,204";
export const RIGHT_HIP_COLLAPSED = "616,204 590,190 560,200 530,192 504,204";
export const STUMP_LEFT = "296,196 330,150 350,172 330,196";
export const STUMP_RIGHT = "504,196 470,160 450,180 470,196";

/** Chimney body runs below its visible box so the roof hides the joint. */
export const CHIMNEY_BODY = {
  x: CHIMNEY_BOX.x,
  y: CHIMNEY_BOX.y,
  w: CHIMNEY_BOX.w,
  h: CHIMNEY_BOX.h + 21,
} as const;

const LEAN_DEG = -2;
const LEAN_PIVOT_X = 400;

/** Transform of the house, decay and windows layers (leaning walls at level 5). */
export function getStructureTransform(features: Pick<LevelFeatures, "structure">): string | undefined {
  return features.structure === "collapsing"
    ? `rotate(${LEAN_DEG} ${LEAN_PIVOT_X} ${GROUND_Y})`
    : undefined;
}

export const CRACK_PATHS: readonly string[] = [
  "M232 192 L240 230 L228 262 L238 300",
  "M560 200 L552 240 L566 270 L556 310",
  "M340 250 L350 280 L338 310 L346 340",
  "M470 290 L480 320 L466 350 L476 385",
];

export const STAINS: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 260, cy: 392, rx: 40, ry: 10 },
  { cx: 480, cy: 394, rx: 50, ry: 10 },
  { cx: 360, cy: 392, rx: 30, ry: 8 },
];

export const PLASTER_HOLE = "430,330 470,322 484,350 466,380 436,372";

export const FOG_BARS: readonly { x: number; y: number; w: number }[] = [
  { x: 40, y: 350, w: 320 },
  { x: 470, y: 322, w: 300 },
  { x: 150, y: 372, w: 400 },
  { x: 380, y: 300, w: 340 },
];
export const FOG_BAR_HEIGHT = 14;
export const FOG_BACK_BARS = 2;
export const FOG_OPACITY = 0.12;

export const BATS: readonly { x: number; y: number }[] = [
  { x: 160, y: 110 },
  { x: 640, y: 90 },
  { x: 250, y: 60 },
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
  { x: 60, y: 40 },
  { x: 180, y: 70 },
  { x: 300, y: 30 },
  { x: 620, y: 50 },
  { x: 700, y: 110 },
  { x: 740, y: 40 },
];
