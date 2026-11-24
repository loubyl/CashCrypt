// Public API of the scene model: buildSceneModel plus re-exports.
// Pure module: no React, GSAP, DOM, clock or random source. The level, score
// and brightness always come from the engine's HouseState and are never recomputed.

import type { DecayLevel } from "@/lib/haunting/config";
import { SCENE_CONFIG, windowOpacityFromFloors } from "./config";
import type { SceneConfig } from "./config";
import { WINDOW_LAYOUT, assignWindowStates } from "./windows";
import { layoutGhosts, layoutPoltergeist, layoutTombstones, layoutZombies } from "./layout";
import { LEVEL_NAMES, buildSceneSummary } from "./summary";
import type {
  Lighting,
  LevelFeatures,
  SceneInput,
  SceneModel,
  SceneWindow,
} from "./types";

export * from "./config";
export * from "./types";
export * from "./features";
export * from "./windows";
export * from "./hash";
export * from "./summary";
export * from "./layout";

const FIRST_LEVEL: DecayLevel = 1;
const LAST_LEVEL: DecayLevel = 5;

/** Non-finite or negative numbers become 0. */
function sanitizeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Level clamped to 1..5; a non-finite level becomes 1. */
function sanitizeLevel(level: number): DecayLevel {
  if (!Number.isFinite(level)) return FIRST_LEVEL;
  const rounded = Math.round(level);
  return Math.min(LAST_LEVEL, Math.max(FIRST_LEVEL, rounded)) as DecayLevel;
}

function pickLighting(level: DecayLevel, hasPoltergeist: boolean): Lighting {
  if (level !== LAST_LEVEL) return "candle";
  return hasPoltergeist ? "poltergeistGlow" : "moonlight";
}

function buildWindows(
  level: DecayLevel,
  brightness: number,
  features: LevelFeatures,
  config: SceneConfig,
): SceneWindow[] {
  const states = assignWindowStates(features);
  const litOpacity = windowOpacityFromFloors(config.OPACITY_FLOOR_BY_LEVEL, level, brightness);
  return WINDOW_LAYOUT.map((slot) => {
    const state = states[slot.index];
    return {
      index: slot.index,
      shape: slot.shape,
      box: { ...slot.box },
      state,
      opacity: state === "lit" ? litOpacity : 0,
    };
  });
}

/** Builds the scene model from engine output. Never mutates `input`. */
export function buildSceneModel(input: SceneInput, config: SceneConfig = SCENE_CONFIG): SceneModel {
  const level = sanitizeLevel(input.houseState.decayLevel);
  const brightness = sanitizeNumber(input.houseState.windowBrightness);
  const levelName = LEVEL_NAMES[level];
  const features: LevelFeatures = { ...config.LEVEL_FEATURES[level] };
  const hasPoltergeist = input.houseState.poltergeist !== null;
  const zombies = layoutZombies(input.houseState.zombies, input.monthlyIncomeCents, config);
  const ghosts = layoutGhosts(input.houseState.ghosts, hasPoltergeist, config);
  const tombstones = layoutTombstones(input.graveyard, config);

  const totals = {
    zombies: input.houseState.zombies.length,
    ghosts: input.houseState.ghosts.length,
    tombstones: input.graveyard.length,
  };
  const poltergeist = layoutPoltergeist(input.houseState.poltergeist, input.bound, config);

  return {
    level,
    levelName,
    features,
    lighting: pickLighting(level, hasPoltergeist),
    windows: buildWindows(level, brightness, features, config),
    zombies: zombies.drawn,
    ghosts: ghosts.drawn,
    poltergeist,
    tombstones: tombstones.drawn,
    totals,
    overflow: {
      zombies: zombies.overflow,
      ghosts: ghosts.overflow,
      tombstones: tombstones.overflow,
    },
    summary: buildSceneSummary({
      level,
      levelName,
      totals,
      poltergeist: poltergeist === null ? null : poltergeist.state,
    }),
  };
}
