// Scene_Model types: plain data that describes what the house scene draws.
// Pure types only: no React, GSAP, DOM or clock.

import type { DecayLevel } from "@/lib/haunting/config";
import type { HouseState } from "@/lib/haunting";

export type { DecayLevel };

export type GraveyardEntry = {
  subscriptionId: string;
  name: string;
  monthlyCostCents: number; // normalized, integer cents
  canceledOn: string; // YYYY-MM-DD
};

export type SceneInput = {
  houseState: HouseState;
  monthlyIncomeCents: number;
  graveyard: readonly GraveyardEntry[];
  bound: boolean; // Bound_Flag
};

/** ViewBox units. */
export type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export type WindowState = "lit" | "boarded" | "broken";
export type WindowShape = "arched" | "square" | "round";
export type SceneWindow = {
  index: number; // 0..WINDOW_COUNT-1
  shape: WindowShape;
  box: Box;
  state: WindowState; // the cover differs per state
  opacity: number; // candlelight, 0 for boarded and broken
};

export type RoofState =
  | "intact"
  | "missingShingles"
  | "sagging"
  | "partialCollapse"
  | "collapsed";
export type GardenState = "green" | "browning" | "dead" | "bare" | "scorched";
export type LanternState = "lit" | "dim" | "unlit";
export type TreeState = "full" | "thin" | "bare" | "twisted" | "charred";
export type FenceState = "intact" | "broken";
export type StructureState = "sound" | "collapsing";
export type FogDensity = 0 | 1 | 2 | 3 | 4;

export type LevelFeatures = {
  crackCount: number;
  stainCount: number;
  plasterHole: boolean;
  boardedWindows: number;
  brokenWindows: number;
  roof: RoofState;
  moss: boolean;
  garden: GardenState;
  lantern: LanternState;
  tree: TreeState;
  fence: FenceState;
  structure: StructureState;
  fog: FogDensity;
  bats: boolean;
  fireflies: boolean;
  shadowPass: boolean;
  darkness: number; // overlay opacity 0..1
};

export type Usage = "often" | "rarely" | "never";
export type ZombiePosture = "upright" | "leaning" | "slumped";
export type ZombieBadge = "flame" | "hourglass" | "skull";

export type SceneZombie = {
  id: string;
  usage: Usage;
  posture: ZombiePosture; // often, rarely, never
  badge: ZombieBadge;
  slot: number;
  box: Box;
  heightUnits: number;
  tiltDeg: number;
  swayPhase: number;
  swayPeriodMs: number;
};

export type GhostLane = 0 | 1 | 2;
export type SceneGhost = {
  id: string;
  sizeUnits: number;
  phase: number;
  bobPeriodMs: number;
  lane: GhostLane;
  orbit: { cx: number; cy: number; rx: number; ry: number };
  rest: Point; // position at phase, used by the static render
};

export type PoltergeistState = "awake" | "bound";
export type ScenePoltergeist = {
  state: PoltergeistState;
  center: Point;
  sizeUnits: number;
  sigil: { cx: number; cy: number; r: number };
};

export type SceneTombstone = {
  id: string;
  slot: number;
  box: Box;
  name: string;
  ripText: string; // "R.I.P. $22.99/mo"
};

export type Lighting = "candle" | "poltergeistGlow" | "moonlight";

export type SceneModel = {
  level: DecayLevel;
  levelName: string;
  features: LevelFeatures;
  lighting: Lighting;
  windows: SceneWindow[];
  zombies: SceneZombie[];
  ghosts: SceneGhost[];
  poltergeist: ScenePoltergeist | null;
  tombstones: SceneTombstone[];
  totals: { zombies: number; ghosts: number; tombstones: number };
  overflow: { zombies: number; ghosts: number; tombstones: number };
  summary: string;
};
