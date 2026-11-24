// Example tests for the scene config (house-scene task 1.4).
// Requirements: 2.5, 6.1, 6.2, 7.6, 15.7.

import { describe, expect, it } from "vitest";
import {
  BAND_MIN_BRIGHTNESS,
  CHIMNEY_BOX,
  MIN_VISIBLE_WINDOW_DELTA,
  POLTERGEIST_CENTER,
  SCENE_CONFIG,
  SIGIL_DIAMETER,
  SIGIL_GLOW_PAD,
  SIGIL_SHAKE,
  SIGIL_STROKE,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  getSigilExtent,
  validateSceneConfig,
} from "@/lib/scene/config";
import { getWindowOpacity } from "@/lib/scene/windows";

type Mutable = Record<string, unknown>;

function withChange(changes: Mutable): unknown {
  return { ...SCENE_CONFIG, ...changes };
}

function problemsOf(changes: Mutable): string[] {
  return validateSceneConfig(withChange(changes));
}

describe("shipped scene config", () => {
  it("passes validateSceneConfig with no problems", () => {
    expect(validateSceneConfig(SCENE_CONFIG)).toEqual([]);
  });

  it("reports a problem for input that is not an object", () => {
    expect(validateSceneConfig(null)).not.toEqual([]);
    expect(validateSceneConfig(42)).not.toEqual([]);
    expect(validateSceneConfig([])).not.toEqual([]);
  });
});

describe("validateSceneConfig, one failing example per rule", () => {
  it("reports a cap that is not an integer of at least 1", () => {
    expect(problemsOf({ MAX_VISIBLE_ZOMBIES: 0 }).join("\n")).toContain("MAX_VISIBLE_ZOMBIES");
    expect(problemsOf({ MAX_VISIBLE_GHOSTS: 1.5 }).join("\n")).toContain("MAX_VISIBLE_GHOSTS");
    expect(problemsOf({ MOMENT_QUEUE_MAX_PENDING: 0 }).join("\n")).toContain("MOMENT_QUEUE_MAX_PENDING");
  });

  it("reports a non-positive ViewBox size", () => {
    expect(problemsOf({ VIEWBOX_WIDTH: 0 }).join("\n")).toContain("VIEWBOX_WIDTH");
  });

  it("reports a moment duration outside the allowed range", () => {
    const durations = { ...SCENE_CONFIG.MOMENT_DURATION_MS, cancel: 100 };
    expect(problemsOf({ MOMENT_DURATION_MS: durations }).join("\n")).toContain("MOMENT_DURATION_MS.cancel");
  });

  it("reports a moment duration above the hard cap", () => {
    const durations = { ...SCENE_CONFIG.MOMENT_DURATION_MS, payment: 5000 };
    expect(problemsOf({ MOMENT_DURATION_MS: durations }).join("\n")).toContain("MOMENT_DURATION_MS.payment");
  });

  it("reports an input unblock time that is not below every moment duration", () => {
    expect(problemsOf({ MOMENT_INPUT_UNBLOCK_MS: 1300 }).join("\n")).toContain("MOMENT_INPUT_UNBLOCK_MS");
  });

  it("reports a window failure order that is not a permutation", () => {
    expect(problemsOf({ WINDOW_FAILURE_ORDER: [0, 0, 1, 2, 3, 4] }).join("\n")).toContain("WINDOW_FAILURE_ORDER");
  });

  it("reports opacity floors that increase from a better level to a worse one", () => {
    const floors = { ...SCENE_CONFIG.OPACITY_FLOOR_BY_LEVEL, 4: 0.5 };
    expect(problemsOf({ OPACITY_FLOOR_BY_LEVEL: floors }).join("\n")).toContain("OPACITY_FLOOR_BY_LEVEL");
  });

  it("reports an opacity floor outside 0 to 1", () => {
    const floors = { ...SCENE_CONFIG.OPACITY_FLOOR_BY_LEVEL, 1: 1.5 };
    expect(problemsOf({ OPACITY_FLOOR_BY_LEVEL: floors }).join("\n")).toContain("OPACITY_FLOOR_BY_LEVEL[1]");
  });

  it("reports a flat curve that fails the level 4 to level 3 step", () => {
    const floors = { 1: 0.8, 2: 0.6, 3: 0.4, 4: 0.39, 5: 0 };
    const problems = problemsOf({ OPACITY_FLOOR_BY_LEVEL: floors });
    expect(problems.join("\n")).toContain("MIN_VISIBLE_WINDOW_DELTA");
  });

  it("reports a payment flare boost outside 0 to 1", () => {
    expect(problemsOf({ PAYMENT_FLARE_BOOST: 0 }).join("\n")).toContain("PAYMENT_FLARE_BOOST");
    expect(problemsOf({ PAYMENT_FLARE_BOOST: 1.2 }).join("\n")).toContain("PAYMENT_FLARE_BOOST");
  });

  it("reports a feature table where severity decreases", () => {
    const table = {
      ...SCENE_CONFIG.LEVEL_FEATURES,
      3: { ...SCENE_CONFIG.LEVEL_FEATURES[3], crackCount: 0 },
    };
    expect(problemsOf({ LEVEL_FEATURES: table }).join("\n")).toContain("LEVEL_FEATURES severity");
  });

  it("reports two levels with identical features", () => {
    const table = { ...SCENE_CONFIG.LEVEL_FEATURES, 2: SCENE_CONFIG.LEVEL_FEATURES[1] };
    expect(problemsOf({ LEVEL_FEATURES: table }).join("\n")).toContain("must differ");
  });

  it("reports an unknown enum value in the feature table", () => {
    const table = {
      ...SCENE_CONFIG.LEVEL_FEATURES,
      2: { ...SCENE_CONFIG.LEVEL_FEATURES[2], roof: "gone" },
    };
    expect(problemsOf({ LEVEL_FEATURES: table }).join("\n")).toContain("LEVEL_FEATURES");
  });

  it("reports a minimum size above its maximum", () => {
    expect(problemsOf({ ZOMBIE_HEIGHT_MIN: 200 }).join("\n")).toContain("ZOMBIE_HEIGHT_MIN");
    expect(problemsOf({ GHOST_SIZE_MIN: 200 }).join("\n")).toContain("GHOST_SIZE_MIN");
  });

  it("reports a sigil smaller than 1.5 times the Poltergeist", () => {
    expect(problemsOf({ SIGIL_DIAMETER: 200 }).join("\n")).toContain("1.5 times");
  });

  it("reports a sigil that leaves the ViewBox", () => {
    expect(problemsOf({ POLTERGEIST_CENTER: { x: 400, y: 100 } }).join("\n")).toContain("inside the ViewBox");
  });

  it("reports a sigil that intersects the chimney", () => {
    // The sigil spans x 123..381 and y 3..249; a chimney moved onto the left wing roof crosses it.
    expect(problemsOf({ CHIMNEY_BOX: { x: 300, y: 105, w: 40, h: 60 } }).join("\n")).toContain("chimney");
  });

  it("reports a moment art box outside the ViewBox", () => {
    const clip = { x: 60, y: 340, w: 900, h: 180 };
    expect(problemsOf({ ZOMBIE_SINK_CLIP: clip }).join("\n")).toContain("ZOMBIE_SINK_CLIP");
  });

  it("reports a moment art point outside the ViewBox", () => {
    expect(problemsOf({ BAT_END: { x: 900, y: 40 } }).join("\n")).toContain("BAT_END");
  });

  it("reports a label size that is not positive", () => {
    expect(problemsOf({ MIN_LABEL_PX: 0 }).join("\n")).toContain("MIN_LABEL_PX");
  });

  it("reports a scene color that is not a hex color", () => {
    expect(problemsOf({ ZOMBIE_BODY: "green" }).join("\n")).toContain("ZOMBIE_BODY");
    const tints = { ...SCENE_CONFIG.DECAY_TINTS, 3: "amber" };
    expect(problemsOf({ DECAY_TINTS: tints }).join("\n")).toContain("DECAY_TINTS[3]");
  });

  it("reports empty ghost lanes", () => {
    expect(problemsOf({ GHOST_LANES: [] }).join("\n")).toContain("GHOST_LANES");
  });

  it("does not throw on hostile values", () => {
    expect(() => validateSceneConfig({ LEVEL_FEATURES: 5, OPACITY_FLOOR_BY_LEVEL: null })).not.toThrow();
    expect(() => validateSceneConfig(withChange({ POLTERGEIST_CENTER: "x", CHIMNEY_BOX: NaN }))).not.toThrow();
  });
});

describe("window opacity step of the demo", () => {
  it("rises by at least the minimum visible delta from level 4 at 0.327 to level 3 at 0.43", () => {
    const step = getWindowOpacity(3, 0.43) - getWindowOpacity(4, 0.327);
    expect(step).toBeGreaterThanOrEqual(MIN_VISIBLE_WINDOW_DELTA);
  });

  it("uses the band boundaries of the haunting engine", () => {
    expect(BAND_MIN_BRIGHTNESS[3]).toBeCloseTo(0.4, 10);
    expect(BAND_MIN_BRIGHTNESS[4]).toBeCloseTo(0.2, 10);
  });
});

describe("sigil geometry", () => {
  const extent = getSigilExtent(
    POLTERGEIST_CENTER,
    SIGIL_DIAMETER,
    SIGIL_STROKE,
    SIGIL_GLOW_PAD,
    SIGIL_SHAKE,
  );

  it("spans y 3 to 249 and x 123 to 381", () => {
    expect(extent.top).toBe(3);
    expect(extent.bottom).toBe(249);
    expect(extent.left).toBe(123);
    expect(extent.right).toBe(381);
  });

  it("lies inside the ViewBox", () => {
    expect(extent.left).toBeGreaterThanOrEqual(0);
    expect(extent.top).toBeGreaterThanOrEqual(0);
    expect(extent.right).toBeLessThanOrEqual(VIEWBOX_WIDTH);
    expect(extent.bottom).toBeLessThanOrEqual(VIEWBOX_HEIGHT);
  });

  it("stays clear of the chimney box", () => {
    expect(extent.right).toBeLessThanOrEqual(CHIMNEY_BOX.x);
  });

  it("is reported when the Poltergeist center moves to y 110", () => {
    const moved = { x: POLTERGEIST_CENTER.x, y: 110 };
    const movedExtent = getSigilExtent(moved, SIGIL_DIAMETER, SIGIL_STROKE, SIGIL_GLOW_PAD, SIGIL_SHAKE);
    expect(movedExtent.top).toBeLessThan(0);
    const problems = problemsOf({ POLTERGEIST_CENTER: moved });
    expect(problems.join("\n")).toContain("the sigil, with stroke, glow padding and shake, must lie inside the ViewBox");
  });
});
