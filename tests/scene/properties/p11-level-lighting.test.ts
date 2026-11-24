// Feature: house-scene, Property 11: Level and lighting follow the engine
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { DecayLevel } from "@/lib/haunting/config";
import type { HouseState } from "@/lib/haunting";
import { LEVEL_NAMES, buildSceneModel, getWindowOpacity } from "@/lib/scene";
import type { SceneInput } from "@/lib/scene";

const NUM_RUNS = 200;
const LAST_LEVEL = 5;

const levelArb = fc.constantFrom<DecayLevel>(1, 2, 3, 4, 5);
// Out-of-range and non-finite levels, to check the clamp.
const hostileLevelArb = fc.oneof(
  levelArb,
  fc.integer({ min: -20, max: 20 }),
  fc.double({ min: -20, max: 20, noNaN: true }),
);
const brightnessArb = fc.oneof(
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.constantFrom(Number.NaN, Infinity, -Infinity, -1, 0, 1, 2),
);
// Deliberately unrelated to the level, so a recomputation from the score would differ.
const scoreArb = fc.double({ min: 0, max: 100, noNaN: true });
const poltergeistArb = fc.option(
  fc.constant({ totalAmount: 5000, transactionCount: 4, byCategory: { coffee: 5000 } }),
  { nil: null },
);

function houseStateArb(level: fc.Arbitrary<number>): fc.Arbitrary<HouseState> {
  return fc
    .record({
      decayLevel: level,
      lightScore: scoreArb,
      windowBrightness: brightnessArb,
      poltergeist: poltergeistArb,
    })
    .map(
      ({ decayLevel, lightScore, windowBrightness, poltergeist }) =>
        ({
          lightScore,
          baseScore: lightScore,
          momentum: 0,
          decayLevel: decayLevel as DecayLevel,
          windowBrightness,
          levelProgress: 0,
          zombies: [],
          ghosts: [],
          poltergeist,
        }) satisfies HouseState,
    );
}

function inputOf(houseState: HouseState): SceneInput {
  return { houseState, monthlyIncomeCents: 300000, graveyard: [], bound: false };
}

function clampLevel(level: number): DecayLevel {
  if (!Number.isFinite(level)) return 1;
  return Math.min(5, Math.max(1, Math.round(level))) as DecayLevel;
}

describe("Property 11: level and lighting follow the engine", () => {
  // **Validates: Requirements 3.7**
  it("uses the engine's decay level, clamped to 1 to 5, even when the light score disagrees", () => {
    fc.assert(
      fc.property(houseStateArb(hostileLevelArb), (houseState) => {
        const model = buildSceneModel(inputOf(houseState));
        expect(model.level).toBe(clampLevel(houseState.decayLevel));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 3.7**
  it("keeps the engine level when the light score points to a different band", () => {
    const state = (decayLevel: DecayLevel, lightScore: number): HouseState => ({
      lightScore,
      baseScore: lightScore,
      momentum: 0,
      decayLevel,
      windowBrightness: lightScore / 100,
      levelProgress: 0,
      zombies: [],
      ghosts: [],
      poltergeist: null,
    });
    expect(buildSceneModel(inputOf(state(1, 5))).level).toBe(1);
    expect(buildSceneModel(inputOf(state(5, 95))).level).toBe(5);
    expect(buildSceneModel(inputOf(state(3, 79.9))).level).toBe(3);
  });

  // **Validates: Requirements 3.7**
  it("gives a level name and summary that match the level", () => {
    fc.assert(
      fc.property(houseStateArb(levelArb), (houseState) => {
        const model = buildSceneModel(inputOf(houseState));
        expect(model.levelName).toBe(LEVEL_NAMES[model.level]);
        expect(model.summary.startsWith(`Level ${model.level}, ${LEVEL_NAMES[model.level]}. `)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 6.4, 6.5**
  it("uses candle lighting at levels 1 to 4 whether or not a Poltergeist exists", () => {
    fc.assert(
      fc.property(
        houseStateArb(fc.constantFrom<DecayLevel>(1, 2, 3, 4)),
        (houseState) => {
          expect(buildSceneModel(inputOf(houseState)).lighting).toBe("candle");
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 6.4, 6.5**
  it("lights level 5 by the Poltergeist glow when it exists and by moonlight otherwise", () => {
    fc.assert(
      fc.property(houseStateArb(fc.constant(LAST_LEVEL)), (houseState) => {
        const expected = houseState.poltergeist !== null ? "poltergeistGlow" : "moonlight";
        expect(buildSceneModel(inputOf(houseState)).lighting).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 6.4**
  it("gives every window opacity 0 at level 5", () => {
    fc.assert(
      fc.property(houseStateArb(fc.constant(LAST_LEVEL)), (houseState) => {
        const model = buildSceneModel(inputOf(houseState));
        for (const window of model.windows) expect(window.opacity).toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 3.7**
  it("derives lit window opacity from the engine's window brightness", () => {
    fc.assert(
      fc.property(houseStateArb(levelArb), (houseState) => {
        const model = buildSceneModel(inputOf(houseState));
        const expected = getWindowOpacity(model.level, houseState.windowBrightness);
        for (const window of model.windows) {
          if (window.state === "lit") expect(window.opacity).toBeCloseTo(expected, 10);
          else expect(window.opacity).toBe(0);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 3.7**
  it("never lowers lit window opacity when the engine's brightness rises at the same level", () => {
    fc.assert(
      fc.property(
        levelArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (level, a, b) => {
          const build = (brightness: number) =>
            buildSceneModel(
              inputOf({
                lightScore: 50,
                baseScore: 50,
                momentum: 0,
                decayLevel: level,
                windowBrightness: brightness,
                levelProgress: 0,
                zombies: [],
                ghosts: [],
                poltergeist: null,
              }),
            ).windows.map((w) => w.opacity);
          const low = build(Math.min(a, b));
          const high = build(Math.max(a, b));
          low.forEach((opacity, i) => expect(high[i]).toBeGreaterThanOrEqual(opacity));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
