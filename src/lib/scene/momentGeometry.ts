// Pure ViewBox geometry of the Moment art: paths, boxes and clips.
// The GSAP files only read these numbers, so the bounds can be tested without GSAP or a DOM.
// Pure module: no React, GSAP, DOM, clock or random source.

import type { MomentRequest } from "@/lib/moments/types";
import {
  BAT_CONTROL,
  BAT_FADE_START,
  CRACK_FLASH_POINTS,
  CRACK_FLASH_STROKE,
  HALF,
  SCENE_CONFIG,
  SHOVEL_CONTROL_LIFT,
  SHOVEL_STRIKE_OFFSET,
  TOMBSTONE_RISE_OFFSET,
  WALL_BOX,
  getSigilExtent,
} from "./config";
import type { SceneConfig } from "./config";
import { getOverflowAnchors } from "./layout";
import type { Box, Point, SceneModel, SceneWindow } from "./types";

const UNIT_MIN = 0;
const UNIT_MAX = 1;
const PAIR = 2;
const LAST_CANDLE_INDEX = 2;
const CANDLE_COUNT = LAST_CANDLE_INDEX + UNIT_MAX;

/** One piece of Moment art: boxes to bound-check and an optional clip that hides overflow. */
export type MomentExtent = { name: string; boxes: Box[]; clip?: Box };

export type BatSample = { point: Point; box: Box; opacity: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function quadratic(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = UNIT_MAX - t;
  return {
    x: u * u * p0.x + PAIR * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + PAIR * u * t * p1.y + t * t * p2.y,
  };
}

function sampleQuadratic(p0: Point, p1: Point, p2: Point, count: number): Point[] {
  const steps = Math.max(UNIT_MAX, Math.floor(count) - UNIT_MAX);
  return Array.from({ length: steps + UNIT_MAX }, (_, i) => quadratic(p0, p1, p2, i / steps));
}

function boxAround(center: Point, halfWidth: number, halfHeight: number): Box {
  return { x: center.x - halfWidth, y: center.y - halfHeight, w: halfWidth * PAIR, h: halfHeight * PAIR };
}

/** Moves a box so that it lies inside `bounds` (when it fits). */
function clampBoxInto(box: Box, bounds: Box): Box {
  return {
    ...box,
    x: clamp(box.x, bounds.x, Math.max(bounds.x, bounds.x + bounds.w - box.w)),
    y: clamp(box.y, bounds.y, Math.max(bounds.y, bounds.y + bounds.h - box.h)),
  };
}

// ---------------------------------------------------------------------------
// Shovel
// ---------------------------------------------------------------------------

export type ShovelArc = { samples: Point[]; start: Point; control: Point; end: Point; boundRadius: number };

/** Centers stay at least SHOVEL_BOUND_RADIUS from every ViewBox side, so each bound circle is inside. */
function clampShovelPoint(p: Point, config: SceneConfig): Point {
  const r = config.SHOVEL_BOUND_RADIUS;
  return {
    x: clamp(p.x, r, config.VIEWBOX_WIDTH - r),
    y: clamp(p.y, r, config.VIEWBOX_HEIGHT - r),
  };
}

/** Shovel center for a blade tip on `target`: half a shovel height above it. */
function liftStrike(target: Point): Point {
  return { x: target.x, y: target.y - SHOVEL_STRIKE_OFFSET };
}

/** The strike point of a cancel: above the zombie, or on the zombie overflow marker. */
export function getShovelStrikePoint(
  model: SceneModel,
  request: Extract<MomentRequest, { kind: "cancel" }>,
  config: SceneConfig = SCENE_CONFIG,
): Point {
  const zombie =
    request.target === "zombie" ? model.zombies.find((z) => z.id === request.subscriptionId) : undefined;
  const raw = zombie
    ? { x: zombie.box.x + zombie.box.w * HALF, y: zombie.box.y - SHOVEL_STRIKE_OFFSET }
    : liftStrike(getOverflowAnchors(config).zombies);
  return clampShovelPoint(raw, config);
}

/** Quadratic arc from SHOVEL_START to `strike`, sampled SHOVEL_ARC_SAMPLES times. */
export function shovelArc(strike: Point, config: SceneConfig = SCENE_CONFIG): ShovelArc {
  const start = clampShovelPoint(config.SHOVEL_START, config);
  const end = clampShovelPoint(strike, config);
  const control = clampShovelPoint(
    {
      x: (start.x + end.x) * HALF,
      y: Math.min(start.y, end.y) - SHOVEL_CONTROL_LIFT,
    },
    config,
  );
  return {
    samples: sampleQuadratic(start, control, end, config.SHOVEL_ARC_SAMPLES),
    start,
    control,
    end,
    boundRadius: config.SHOVEL_BOUND_RADIUS,
  };
}

// ---------------------------------------------------------------------------
// Zombie sink and tombstone rise
// ---------------------------------------------------------------------------

/** The zombie box scaled by ZOMBIE_SINK_SCALE around its bottom center, kept inside the sink clip. */
export function getSinkingZombieBox(zombieBox: Box, config: SceneConfig = SCENE_CONFIG): Box {
  const w = zombieBox.w * config.ZOMBIE_SINK_SCALE;
  const h = zombieBox.h * config.ZOMBIE_SINK_SCALE;
  const scaled = {
    x: zombieBox.x + zombieBox.w * HALF - w * HALF,
    y: zombieBox.y + zombieBox.h - h,
    w,
    h,
  };
  return clampBoxInto(scaled, config.ZOMBIE_SINK_CLIP);
}

export function getSinkClip(config: SceneConfig = SCENE_CONFIG): Box {
  return { ...config.ZOMBIE_SINK_CLIP };
}

/** `start` is TOMBSTONE_RISE_OFFSET below `final`; only `final` is drawn outside the clip's hidden part. */
export function getTombstoneRiseBoxes(finalBox: Box): { start: Box; final: Box } {
  return { start: { ...finalBox, y: finalBox.y + TOMBSTONE_RISE_OFFSET }, final: { ...finalBox } };
}

export function getTombstoneClip(config: SceneConfig = SCENE_CONFIG): Box {
  return { ...config.TOMBSTONE_CLIP };
}

// ---------------------------------------------------------------------------
// Bat (dawn)
// ---------------------------------------------------------------------------

/** Bat flight samples; opacity fades to 0 over the last (1 - BAT_FADE_START) of the path. */
export function batPath(config: SceneConfig = SCENE_CONFIG, sampleCount: number = config.BAT_PATH_SAMPLES): BatSample[] {
  const points = sampleQuadratic(config.BAT_START, BAT_CONTROL, config.BAT_END, sampleCount);
  const last = Math.max(UNIT_MAX, points.length - UNIT_MAX);
  return points.map((point, i) => {
    const t = i / last;
    const fade = clamp((t - BAT_FADE_START) / (UNIT_MAX - BAT_FADE_START), UNIT_MIN, UNIT_MAX);
    return {
      point,
      box: boxAround(point, config.BAT_HALF_SIZE, config.BAT_HALF_SIZE),
      opacity: UNIT_MAX - fade,
    };
  });
}

// ---------------------------------------------------------------------------
// Orb endpoint and flame fallback
// ---------------------------------------------------------------------------

function pxToUnits(px: number, config: SceneConfig): number {
  return px * (config.VIEWBOX_WIDTH / config.MIN_SCENE_WIDTH_PX);
}

function windowCenter(window: SceneWindow): Point {
  return { x: window.box.x + window.box.w * HALF, y: window.box.y + window.box.h * HALF };
}

/** Center of the first lit window (lowest index); falls back to the first window, then the wall center. */
export function getOrbEndpoint(model: SceneModel): Point {
  const sorted = [...model.windows].sort((a, b) => a.index - b.index);
  const target = sorted.find((w) => w.state === "lit") ?? sorted[0];
  if (target) return windowCenter(target);
  return { x: WALL_BOX.x + WALL_BOX.w * HALF, y: WALL_BOX.y + WALL_BOX.h * HALF };
}

/** Orb art box at the endpoint, extended by half the orb at the smallest Scene scale. */
export function getOrbBox(model: SceneModel, config: SceneConfig = SCENE_CONFIG): Box {
  const half = pxToUnits(config.ORB_PX, config) * HALF;
  return boxAround(getOrbEndpoint(model), half, half);
}

/** Flame start when the submit control is gone: bottom center of the Scene, flame fully inside. */
export function getFlameFallbackPoint(config: SceneConfig = SCENE_CONFIG): Point {
  return {
    x: config.VIEWBOX_WIDTH * HALF,
    y: config.VIEWBOX_HEIGHT - pxToUnits(config.FLAME_PX, config),
  };
}

export function getFlameFallbackBox(config: SceneConfig = SCENE_CONFIG): Box {
  const half = pxToUnits(config.ORB_PX, config) * HALF;
  return boxAround(getFlameFallbackPoint(config), half, half);
}

// ---------------------------------------------------------------------------
// Crack flash, shutter, candles
// ---------------------------------------------------------------------------

/** Crack polyline across the walls and its bounding box (including half the stroke). */
export function getCrackFlash(): { points: Point[]; box: Box; stroke: number } {
  const points = CRACK_FLASH_POINTS.map((p) => ({ ...p }));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = CRACK_FLASH_STROKE * HALF;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return {
    points,
    stroke: CRACK_FLASH_STROKE,
    box: { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y },
  };
}

/** Window box widened by SHUTTER_WIDTH on its swing side (outward from the house axis). */
export function getShutterBox(window: SceneWindow, config: SceneConfig = SCENE_CONFIG): Box {
  const swingsLeft = windowCenter(window).x < config.VIEWBOX_WIDTH * HALF;
  const { box } = window;
  return swingsLeft
    ? { x: box.x - config.SHUTTER_WIDTH, y: box.y, w: box.w + config.SHUTTER_WIDTH, h: box.h }
    : { ...box, w: box.w + config.SHUTTER_WIDTH };
}

/** The window whose shutter swings: the lowest-index window, or null when there is none. */
export function pickShutterWindow(model: SceneModel): SceneWindow | null {
  const sorted = [...model.windows].sort((a, b) => a.index - b.index);
  return sorted[0] ?? null;
}

/** Three candle boxes in a row, left to right. */
export function getCandleBoxes(config: SceneConfig = SCENE_CONFIG): Box[] {
  return Array.from({ length: CANDLE_COUNT }, (_, i) => ({
    x: config.CANDLE_ROW_ORIGIN.x + i * config.CANDLE_SPACING,
    y: config.CANDLE_ROW_ORIGIN.y,
    w: config.CANDLE_BOX.w,
    h: config.CANDLE_BOX.h,
  }));
}

// ---------------------------------------------------------------------------
// Sigil
// ---------------------------------------------------------------------------

/** Outer box of the sigil with stroke, glow padding and shake. */
export function getSigilBox(model: SceneModel, config: SceneConfig = SCENE_CONFIG): Box {
  const center = model.poltergeist?.center ?? config.POLTERGEIST_CENTER;
  const e = getSigilExtent(center, config.SIGIL_DIAMETER, config.SIGIL_STROKE, config.SIGIL_GLOW_PAD, config.SIGIL_SHAKE);
  return { x: e.left, y: e.top, w: e.right - e.left, h: e.bottom - e.top };
}

// ---------------------------------------------------------------------------
// Extents per request
// ---------------------------------------------------------------------------

function cancelExtents(
  model: SceneModel,
  request: Extract<MomentRequest, { kind: "cancel" }>,
  config: SceneConfig,
): MomentExtent[] {
  const arc = shovelArc(getShovelStrikePoint(model, request, config), config);
  const extents: MomentExtent[] = [
    {
      name: "shovel",
      boxes: arc.samples.map((p) => boxAround(p, arc.boundRadius, arc.boundRadius)),
    },
  ];
  const zombie = request.target === "zombie" ? model.zombies.find((z) => z.id === request.subscriptionId) : undefined;
  if (zombie) {
    extents.push({ name: "zombieSink", boxes: [getSinkingZombieBox(zombie.box, config)], clip: getSinkClip(config) });
  }
  const tombstone = model.tombstones.find((t) => t.id === request.subscriptionId);
  if (tombstone) {
    extents.push({
      name: "tombstoneRise",
      boxes: [getTombstoneRiseBoxes(tombstone.box).final],
      clip: getTombstoneClip(config),
    });
  }
  return extents;
}

function paymentExtents(
  model: SceneModel,
  request: Extract<MomentRequest, { kind: "payment" }>,
  config: SceneConfig,
): MomentExtent[] {
  const extents: MomentExtent[] = [{ name: "orb", boxes: [getOrbBox(model, config)] }];
  if (request.origin === null) extents.push({ name: "flameFallback", boxes: [getFlameFallbackBox(config)] });
  if (request.hasCrack) extents.push({ name: "crackFlash", boxes: [getCrackFlash().box] });
  return extents;
}

function levelExtents(
  model: SceneModel,
  request: Extract<MomentRequest, { kind: "level" }>,
  config: SceneConfig,
): MomentExtent[] {
  if (request.to < request.from) {
    return [{ name: "bat", boxes: batPath(config).map((s) => s.box) }];
  }
  const extents: MomentExtent[] = [{ name: "crackFlash", boxes: [getCrackFlash().box] }];
  const shutterWindow = pickShutterWindow(model);
  if (shutterWindow) extents.push({ name: "shutter", boxes: [getShutterBox(shutterWindow, config)] });
  return extents;
}

/** Every piece of ViewBox art a request draws, for bounds checks and for the GSAP files. */
export function getMomentExtents(
  model: SceneModel,
  request: MomentRequest,
  config: SceneConfig = SCENE_CONFIG,
): MomentExtent[] {
  switch (request.kind) {
    case "cancel":
      return cancelExtents(model, request, config);
    case "payment":
      return paymentExtents(model, request, config);
    case "sigil":
      return [{ name: "sigil", boxes: [getSigilBox(model, config)] }];
    case "exorcismComplete":
      return [{ name: "candles", boxes: getCandleBoxes(config) }];
    case "level":
      return levelExtents(model, request, config);
  }
}
