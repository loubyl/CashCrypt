// Layout of the creatures: zombie slots, ghost lanes, tombstone slots, the
// Poltergeist and the overflow anchors. All coordinates are ViewBox units.
// Pure module: no React, GSAP, DOM, clock or random source. Every
// random-looking value derives from a hash of the row id, never from order.

import type { Ghost, Poltergeist, Zombie } from "@/lib/haunting";
import { SMALL_EXPENSE_THRESHOLD_CENTS } from "@/lib/haunting/config";
import { formatCentsShort } from "@/lib/utils/cents";
import {
  FULL_TURN_RADIANS,
  GHOST_OVERFLOW_ANCHOR,
  HALF,
  NO_COUNT,
  SLOT_FIRST,
  SCENE_CONFIG,
  ZOMBIE_SWAY_PERIOD_MAX_MS,
  ZOMBIE_SWAY_PERIOD_MIN_MS,
  ZOMBIE_TILT_DEG,
  GHOST_BOB_PERIOD_MAX_MS,
  GHOST_BOB_PERIOD_MIN_MS,
  GHOST_MIN_REST_DISTANCE,
  GHOST_PHASE_STEPS,
  BADGE_SIZE,
  ZOMBIE_BADGE_GAP,
  LABEL_LINE_HEIGHT_PX,
  TOMBSTONE_LABEL_MAX_LINES,
  TOMBSTONE_LABEL_WIDTH_SLOTS,
} from "./config";
import type { SceneConfig } from "./config";
import { unitFromId } from "./hash";
import type {
  Box,
  GhostLane,
  GraveyardEntry,
  Point,
  SceneGhost,
  ScenePoltergeist,
  SceneTombstone,
  SceneZombie,
  Usage,
  ZombieBadge,
  ZombiePosture,
} from "./types";

const UNIT_MIN = 0;
const UNIT_MAX = 1;
const RIP_PREFIX = "R.I.P. ";
const PER_MONTH_SUFFIX = "/mo";
const SALT_TILT = "tilt";
const SALT_SWAY_PHASE = "swayPhase";
const SALT_SWAY_PERIOD = "swayPeriod";
const SALT_LANE = "lane";
const SALT_GHOST_PHASE = "ghostPhase";
const SALT_BOB_PERIOD = "bobPeriod";

const POSTURE_BY_USAGE: Readonly<Record<Usage, ZombiePosture>> = {
  often: "upright",
  rarely: "leaning",
  never: "slumped",
};
const BADGE_BY_USAGE: Readonly<Record<Usage, ZombieBadge>> = {
  often: "flame",
  rarely: "hourglass",
  never: "skull",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Non-finite or negative numbers become 0. */
function nonNegative(value: number): number {
  return Number.isFinite(value) && value > UNIT_MIN ? value : UNIT_MIN;
}

/** Id order that never depends on locale. */
function compareIds(a: string, b: string): number {
  if (a < b) return -UNIT_MAX;
  return a > b ? UNIT_MAX : UNIT_MIN;
}

export type OverflowAnchors = { zombies: Point; ghosts: Point; tombstones: Point };

/** Anchors of the "+N" markers (the HTML overlay positions text from them). */
export function getOverflowAnchors(config: SceneConfig = SCENE_CONFIG): OverflowAnchors {
  const basement = config.BASEMENT_BAND;
  const graveyard = config.GRAVEYARD_BAND;
  return {
    zombies: { x: basement.x + basement.w, y: config.ZOMBIE_BASELINE_Y },
    ghosts: { ...GHOST_OVERFLOW_ANCHOR },
    tombstones: { x: graveyard.x + graveyard.w, y: config.TOMBSTONE_BASELINE_Y },
  };
}

/** Zombies sorted by monthly cost descending, then id ascending; the first `cap` are drawn. */
export function layoutZombies(
  zombies: readonly Zombie[],
  monthlyIncomeCents: number,
  config: SceneConfig = SCENE_CONFIG,
): { drawn: SceneZombie[]; overflow: number } {
  const income = nonNegative(monthlyIncomeCents);
  const sorted = [...zombies].sort(
    (a, b) =>
      nonNegative(b.monthlyCost) - nonNegative(a.monthlyCost) ||
      compareIds(a.subscriptionId, b.subscriptionId),
  );
  const visible = sorted.slice(SLOT_FIRST, config.MAX_VISIBLE_ZOMBIES);
  const slotWidth = config.BASEMENT_BAND.w / config.MAX_VISIBLE_ZOMBIES;
  const rowStart =
    config.BASEMENT_BAND.x + ((config.MAX_VISIBLE_ZOMBIES - visible.length) * slotWidth) * HALF;
  const drawn = visible.map((zombie, slot) => {
    const ratio = income > UNIT_MIN ? nonNegative(zombie.monthlyCost) / income : UNIT_MIN;
    const fullness = clamp(ratio / config.ZOMBIE_FULL_RATIO, UNIT_MIN, UNIT_MAX);
    const height = lerp(config.ZOMBIE_HEIGHT_MIN, config.ZOMBIE_HEIGHT_MAX, fullness);
    const width = height * config.ZOMBIE_WIDTH_RATIO;
    const centerX = rowStart + (slot + HALF) * slotWidth;
    const id = zombie.subscriptionId;
    return {
      id,
      usage: zombie.usage,
      posture: POSTURE_BY_USAGE[zombie.usage],
      badge: BADGE_BY_USAGE[zombie.usage],
      slot,
      box: {
        x: centerX - width * HALF,
        y: config.ZOMBIE_BASELINE_Y - height,
        w: width,
        h: height,
      },
      heightUnits: height,
      badgeCenter: {
        x: centerX,
        y: config.ZOMBIE_BASELINE_Y - height - ZOMBIE_BADGE_GAP - BADGE_SIZE * HALF,
      },
      tiltDeg: lerp(-ZOMBIE_TILT_DEG, ZOMBIE_TILT_DEG, unitFromId(id, SALT_TILT)),
      swayPhase: FULL_TURN_RADIANS * unitFromId(id, SALT_SWAY_PHASE),
      swayPeriodMs: lerp(
        ZOMBIE_SWAY_PERIOD_MIN_MS,
        ZOMBIE_SWAY_PERIOD_MAX_MS,
        unitFromId(id, SALT_SWAY_PERIOD),
      ),
    };
  });
  return { drawn, overflow: sorted.length - visible.length };
}

/** Point of a figure-eight lane (Gerono lemniscate) at angle `t`. */
export function getLanePoint(
  lane: { cx: number; cy: number; rx: number; ry: number },
  t: number,
): Point {
  return {
    x: lane.cx + lane.rx * Math.sin(t),
    y: lane.cy + lane.ry * Math.sin(t) * Math.cos(t),
  };
}

/** Lane of a ghost, from its id only. */
export function getGhostLane(id: string, laneCount: number): GhostLane {
  return Math.min(laneCount - UNIT_MAX, Math.floor(unitFromId(id, SALT_LANE) * laneCount)) as GhostLane;
}

/** Preferred phase of a ghost, from its id only (Requirement 3.4). */
export function getPreferredGhostPhase(id: string): number {
  return FULL_TURN_RADIANS * unitFromId(id, SALT_GHOST_PHASE);
}

/** Candidate phases of a ghost: its preferred phase, then forward in whole steps, in [0, 2π). */
export function getGhostPhaseCandidates(id: string): number[] {
  const preferred = getPreferredGhostPhase(id);
  const step = FULL_TURN_RADIANS / GHOST_PHASE_STEPS;
  return Array.from({ length: GHOST_PHASE_STEPS }, (_, k) => (preferred + k * step) % FULL_TURN_RADIANS);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Smallest distance from `point` to any placed rest (Infinity when none). */
function clearance(point: Point, placed: readonly Point[]): number {
  return placed.reduce((min, other) => Math.min(min, distance(point, other)), Number.POSITIVE_INFINITY);
}

/**
 * Picks the phase of each drawn ghost. Ghosts are placed in id order, so a ghost depends only
 * on its own id and the drawn ghosts with smaller ids. The first candidate whose rest point is
 * at least GHOST_MIN_REST_DISTANCE from every placed rest wins. When none is (the lane is
 * crowded), the candidate with the largest clearance wins, the earliest on ties.
 */
function placeGhostPhases(
  ghosts: readonly { id: string; orbit: SceneGhost["orbit"] }[],
): Map<string, number> {
  const phases = new Map<string, number>();
  const placed: Point[] = [];
  const byId = [...ghosts].sort((a, b) => compareIds(a.id, b.id));
  for (const ghost of byId) {
    const candidates = getGhostPhaseCandidates(ghost.id);
    let best = candidates[SLOT_FIRST];
    let bestClearance = Number.NEGATIVE_INFINITY;
    for (const phase of candidates) {
      const gap = clearance(getLanePoint(ghost.orbit, phase), placed);
      if (gap >= GHOST_MIN_REST_DISTANCE) {
        best = phase;
        break;
      }
      if (gap > bestClearance) {
        best = phase;
        bestClearance = gap;
      }
    }
    phases.set(ghost.id, best);
    placed.push(getLanePoint(ghost.orbit, best));
  }
  return phases;
}

/**
 * Ghosts sorted by amount descending, then id; the first `cap` are drawn.
 * While a Poltergeist exists the ghosts have merged into it: none are drawn
 * and there is no overflow.
 */
export function layoutGhosts(
  ghosts: readonly Ghost[],
  hasPoltergeist: boolean,
  config: SceneConfig = SCENE_CONFIG,
): { drawn: SceneGhost[]; overflow: number } {
  if (hasPoltergeist) return { drawn: [], overflow: NO_COUNT };
  const sorted = [...ghosts].sort(
    (a, b) => nonNegative(b.amount) - nonNegative(a.amount) || compareIds(a.transactionId, b.transactionId),
  );
  const visible = sorted.slice(SLOT_FIRST, config.MAX_VISIBLE_GHOSTS).map((ghost) => {
    const id = ghost.transactionId;
    const lane = getGhostLane(id, config.GHOST_LANES.length);
    return { ghost, id, lane, orbit: { ...config.GHOST_LANES[lane] } };
  });
  const phases = placeGhostPhases(visible);
  const drawn = visible.map(({ ghost, id, lane, orbit }) => {
    const phase = phases.get(id) ?? getPreferredGhostPhase(id);
    const fullness = clamp(
      nonNegative(ghost.amount) / SMALL_EXPENSE_THRESHOLD_CENTS,
      UNIT_MIN,
      UNIT_MAX,
    );
    return {
      id,
      sizeUnits: lerp(config.GHOST_SIZE_MIN, config.GHOST_SIZE_MAX, fullness),
      phase,
      bobPeriodMs: lerp(GHOST_BOB_PERIOD_MIN_MS, GHOST_BOB_PERIOD_MAX_MS, unitFromId(id, SALT_BOB_PERIOD)),
      lane,
      orbit,
      rest: getLanePoint(orbit, phase),
    };
  });
  return { drawn, overflow: sorted.length - visible.length };
}

/** Graveyard entries sorted newest first, then id; the first `cap` get a slot from the left. */
export function layoutTombstones(
  graveyard: readonly GraveyardEntry[],
  config: SceneConfig = SCENE_CONFIG,
): { drawn: SceneTombstone[]; overflow: number } {
  const sorted = [...graveyard].sort(
    (a, b) => compareIds(b.canceledOn, a.canceledOn) || compareIds(a.subscriptionId, b.subscriptionId),
  );
  const visible = sorted.slice(SLOT_FIRST, config.MAX_VISIBLE_TOMBSTONES);
  const slotWidth = config.GRAVEYARD_BAND.w / config.MAX_VISIBLE_TOMBSTONES;
  const drawn = visible.map((entry, slot) => {
    const centerX = config.GRAVEYARD_BAND.x + (slot + HALF) * slotWidth;
    return {
      id: entry.subscriptionId,
      slot,
      box: {
        x: centerX - config.TOMBSTONE_BOX_WIDTH * HALF,
        y: config.TOMBSTONE_BASELINE_Y - config.TOMBSTONE_BOX_HEIGHT,
        w: config.TOMBSTONE_BOX_WIDTH,
        h: config.TOMBSTONE_BOX_HEIGHT,
      },
      name: entry.name,
      ripText: `${RIP_PREFIX}${formatCentsShort(nonNegative(entry.monthlyCostCents))}${PER_MONTH_SUFFIX}`,
    };
  });
  return { drawn, overflow: sorted.length - visible.length };
}

/** The single Poltergeist: `bound` while the Bound_Flag is set, else `awake`. */
export function layoutPoltergeist(
  poltergeist: Poltergeist | null,
  bound: boolean,
  config: SceneConfig = SCENE_CONFIG,
): ScenePoltergeist | null {
  if (poltergeist === null) return null;
  const center = { ...config.POLTERGEIST_CENTER };
  return {
    state: bound ? "bound" : "awake",
    center,
    sizeUnits: config.POLTERGEIST_SIZE,
    sigil: { cx: center.x, cy: center.y, r: config.SIGIL_DIAMETER * HALF },
  };
}

/**
 * Box of a tombstone label in ViewBox units at a measured Scene width (px). The label is
 * TOMBSTONE_LABEL_WIDTH_SLOTS slots wide, centered on its tombstone. Its bottom sits on the bottom of
 * the graveyard band and it grows upward by at most TOMBSTONE_LABEL_MAX_LINES lines, so it never runs
 * below the Scene and the top of the slab stays visible above it.
 */
export function getTombstoneLabelBox(
  tombstone: SceneTombstone,
  sceneWidthPx: number,
  config: SceneConfig = SCENE_CONFIG,
): Box {
  const unitsPerPx = config.VIEWBOX_WIDTH / Math.max(sceneWidthPx, UNIT_MAX);
  const width = (config.GRAVEYARD_BAND.w / config.MAX_VISIBLE_TOMBSTONES) * TOMBSTONE_LABEL_WIDTH_SLOTS;
  const height = TOMBSTONE_LABEL_MAX_LINES * LABEL_LINE_HEIGHT_PX * unitsPerPx;
  const bottom = config.GRAVEYARD_BAND.y + config.GRAVEYARD_BAND.h;
  return {
    x: tombstone.box.x + tombstone.box.w * HALF - width * HALF,
    y: bottom - height,
    w: width,
    h: height,
  };
}
