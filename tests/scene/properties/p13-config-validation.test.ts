// Feature: house-scene, Property 13: Config validation never throws and flags broken configs
// Validates: Requirements 2.4, 2.5

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  MOMENT_HARD_CAP_MS,
  MOMENT_MIN_DURATION_MS,
  SCENE_CONFIG,
  validateSceneConfig,
} from "@/lib/scene/config";

const NUM_RUNS = 150;

type Obj = Record<string, unknown>;

function copyConfig(): Obj {
  return structuredClone(SCENE_CONFIG) as unknown as Obj;
}

function expectProblemList(result: unknown): void {
  expect(Array.isArray(result)).toBe(true);
  for (const item of result as unknown[]) expect(typeof item).toBe("string");
}

/** Keys that validateSceneConfig checks directly; removing any must be flagged. */
const CHECKED_KEYS = [
  "MAX_VISIBLE_ZOMBIES", "MAX_VISIBLE_GHOSTS", "MAX_VISIBLE_TOMBSTONES", "WINDOW_COUNT",
  "MOMENT_QUEUE_MAX_PENDING", "VIEWBOX_WIDTH", "VIEWBOX_HEIGHT", "REFERENCE_WIDTH_PX",
  "MOMENT_HARD_CAP_MS", "MOMENT_INPUT_UNBLOCK_MS", "MOMENT_DURATION_MS", "WINDOW_FAILURE_ORDER",
  "MIN_VISIBLE_WINDOW_DELTA", "PAYMENT_FLARE_BOOST", "OPACITY_FLOOR_BY_LEVEL", "LEVEL_FEATURES",
  "SIGIL_DIAMETER", "POLTERGEIST_CENTER", "CHIMNEY_BOX", "BASEMENT_BAND", "GHOST_LANES",
  "DECAY_TINTS", "ZOMBIE_BODY",
] as const;

const CAP_KEYS = [
  "MAX_VISIBLE_ZOMBIES", "MAX_VISIBLE_GHOSTS", "MAX_VISIBLE_TOMBSTONES", "WINDOW_COUNT",
  "MOMENT_QUEUE_MAX_PENDING",
] as const;
const BAD_CAPS = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY] as const;
const VIEWBOX_KEYS = ["VIEWBOX_WIDTH", "VIEWBOX_HEIGHT", "REFERENCE_WIDTH_PX"] as const;
const BAD_VIEWBOX = [0, -10, Number.NaN, Number.POSITIVE_INFINITY] as const;
const DURATION_KEYS = ["cancel", "payment", "sigil", "levelBetter", "levelWorse", "exorcismComplete"] as const;
const BAD_FLARE = [0, -0.1, 1.01, 5, Number.NaN] as const;

describe("Property 13: Config validation never throws and flags broken configs", () => {
  it("never throws and returns a string list for arbitrary unknown input", () => {
    const garbage = fc.oneof(
      fc.anything(),
      fc.constantFrom<unknown>(null, undefined, Number.NaN, Number.POSITIVE_INFINITY, [], {}, "", 0),
      fc.object({ maxDepth: 4, withNullPrototype: true }),
      fc.array(fc.anything()),
    );
    fc.assert(
      fc.property(garbage, (input) => {
        expectProblemList(validateSceneConfig(input));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("never throws when one field of the shipped config is replaced by garbage", () => {
    const keys = Object.keys(SCENE_CONFIG);
    fc.assert(
      fc.property(
        fc.constantFrom(...keys),
        fc.oneof(fc.anything(), fc.constantFrom<unknown>(null, undefined, Number.NaN, Number.NEGATIVE_INFINITY)),
        (key, value) => {
          const config = copyConfig();
          config[key] = value;
          expectProblemList(validateSceneConfig(config));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("never throws when nested objects of the shipped config receive garbage", () => {
    const nested = ["MOMENT_DURATION_MS", "OPACITY_FLOOR_BY_LEVEL", "LEVEL_FEATURES", "DECAY_TINTS", "POLTERGEIST_CENTER", "CHIMNEY_BOX"];
    fc.assert(
      fc.property(
        fc.constantFrom(...nested),
        fc.string({ maxLength: 12 }),
        fc.oneof(fc.anything(), fc.constantFrom<unknown>(null, Number.NaN)),
        (key, inner, value) => {
          const config = copyConfig();
          const target = config[key] as Obj;
          const innerKeys = Object.keys(target);
          const pick = innerKeys.length > 0 ? innerKeys[inner.length % innerKeys.length] : inner;
          target[pick] = value;
          expectProblemList(validateSceneConfig(config));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns an empty list for the shipped config", () => {
    expect(validateSceneConfig(SCENE_CONFIG)).toEqual([]);
    expect(validateSceneConfig(copyConfig())).toEqual([]);
  });

  it("flags a cap that is zero, negative, fractional or not finite", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CAP_KEYS), fc.constantFrom(...BAD_CAPS), (key, bad) => {
        const config = copyConfig();
        config[key] = bad;
        expect(validateSceneConfig(config).length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags a ViewBox dimension that is not a positive finite number", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VIEWBOX_KEYS), fc.constantFrom(...BAD_VIEWBOX), (key, bad) => {
        const config = copyConfig();
        config[key] = bad;
        expect(validateSceneConfig(config).length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags a moment duration below the minimum or above the hard cap", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DURATION_KEYS),
        fc.boolean(),
        fc.integer({ min: 1, max: 5000 }),
        (key, tooLow, offset) => {
          const config = copyConfig();
          const durations = config.MOMENT_DURATION_MS as Obj;
          durations[key] = tooLow ? MOMENT_MIN_DURATION_MS - offset : MOMENT_HARD_CAP_MS + offset;
          expect(validateSceneConfig(config).length).toBeGreaterThan(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags an input unblock time at or above a moment duration", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DURATION_KEYS),
        fc.integer({ min: 0, max: 1000 }),
        (key, extra) => {
          const config = copyConfig();
          const durations = config.MOMENT_DURATION_MS as Obj;
          config.MOMENT_INPUT_UNBLOCK_MS = (durations[key] as number) + extra;
          expect(validateSceneConfig(config).length).toBeGreaterThan(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags a payment flare boost outside (0, 1]", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BAD_FLARE), (bad) => {
        const config = copyConfig();
        config.PAYMENT_FLARE_BOOST = bad;
        expect(validateSceneConfig(config).length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags a sigil that leaves the ViewBox", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2000, max: 100 }),
        fc.integer({ min: -2000, max: 100 }),
        (x, y) => {
          const config = copyConfig();
          config.POLTERGEIST_CENTER = { x, y };
          expect(validateSceneConfig(config).length).toBeGreaterThan(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags a sigil diameter that is too small for the Poltergeist", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (diameter) => {
        const config = copyConfig();
        config.SIGIL_DIAMETER = diameter;
        expect(validateSceneConfig(config).length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags reversed opacity floors", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 1, noNaN: true }), (value) => {
        const config = copyConfig();
        // Level 5 above level 4 (0.02) reverses the order.
        config.OPACITY_FLOOR_BY_LEVEL = { ...(config.OPACITY_FLOOR_BY_LEVEL as Obj), 5: value };
        expect(validateSceneConfig(config).length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags a window failure order that is not a permutation", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), (index) => {
        const config = copyConfig();
        const order = [...(config.WINDOW_FAILURE_ORDER as number[])];
        order[index] = order[(index + 1) % order.length];
        config.WINDOW_FAILURE_ORDER = order;
        expect(validateSceneConfig(config).length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags a config with a validated field removed", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CHECKED_KEYS), (key) => {
        const config = copyConfig();
        delete config[key];
        expect(validateSceneConfig(config).length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags values that are not objects", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.double(), fc.boolean(), fc.array(fc.anything()), fc.constantFrom<unknown>(null, undefined)),
        (input) => {
          expect(validateSceneConfig(input).length).toBeGreaterThan(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
