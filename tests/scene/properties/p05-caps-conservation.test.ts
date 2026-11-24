// Feature: house-scene, Property 5: Caps and conservation
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MAX_VISIBLE_GHOSTS,
  MAX_VISIBLE_TOMBSTONES,
  MAX_VISIBLE_ZOMBIES,
  buildSceneModel,
} from "@/lib/scene";
import type { SceneInput } from "@/lib/scene/types";
import {
  anySceneInputArb,
  ghostArb,
  maxSceneInputArb,
  poltergeistArb,
  sceneInputArb,
  MAX_GHOSTS,
} from "../arbitraries";

const NUM_RUNS = 200;

/** Valid inputs with a Poltergeist and at least one ghost, up to the input limit. */
const poltergeistWithGhostsArb: fc.Arbitrary<SceneInput> = fc
  .record({
    input: sceneInputArb,
    poltergeist: poltergeistArb,
    ghosts: fc.array(ghostArb, { minLength: 1, maxLength: MAX_GHOSTS }),
  })
  .map(({ input, poltergeist, ghosts }) => ({
    ...input,
    houseState: { ...input.houseState, poltergeist, ghosts },
  }));

describe("Property 5: caps and conservation", () => {
  // **Validates: Requirements 4.1, 4.2, 4.8, 9.1, 9.2, 21.6**
  it("draws at most the cap of each kind", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        const model = buildSceneModel(input);
        expect(model.zombies.length).toBeLessThanOrEqual(MAX_VISIBLE_ZOMBIES);
        expect(model.ghosts.length).toBeLessThanOrEqual(MAX_VISIBLE_GHOSTS);
        expect(model.tombstones.length).toBeLessThanOrEqual(MAX_VISIBLE_TOMBSTONES);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.1, 4.2, 4.8, 9.1, 9.2, 21.6**
  it("makes drawn plus overflow equal the totals for zombies and tombstones", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        const model = buildSceneModel(input);
        expect(model.zombies.length + model.overflow.zombies).toBe(model.totals.zombies);
        expect(model.tombstones.length + model.overflow.tombstones).toBe(model.totals.tombstones);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.1, 4.2, 4.8, 9.1, 9.2, 21.6**
  it("makes drawn plus overflow equal the ghost total while no Poltergeist exists", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        fc.pre(input.houseState.poltergeist === null);
        const model = buildSceneModel(input);
        expect(model.ghosts.length + model.overflow.ghosts).toBe(model.totals.ghosts);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.1, 4.2, 4.8, 9.1, 9.2, 21.6**
  it("reports totals equal to the true row counts of the input", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        const { totals } = buildSceneModel(input);
        expect(totals.zombies).toBe(input.houseState.zombies.length);
        expect(totals.ghosts).toBe(input.houseState.ghosts.length);
        expect(totals.tombstones).toBe(input.graveyard.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.1, 4.2, 4.8, 9.1, 9.2, 21.6**
  it("draws no ghosts and reports no ghost overflow while a Poltergeist exists, keeping the ghost total", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        fc.pre(input.houseState.poltergeist !== null);
        const model = buildSceneModel(input);
        expect(model.ghosts).toHaveLength(0);
        expect(model.overflow.ghosts).toBe(0);
        expect(model.totals.ghosts).toBe(input.houseState.ghosts.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.1, 4.2, 4.8, 9.1, 9.2, 21.6**
  it("draws no ghosts and reports no overflow when a Poltergeist exists and ghosts exist", () => {
    fc.assert(
      fc.property(poltergeistWithGhostsArb, (input) => {
        expect(input.houseState.poltergeist).not.toBeNull();
        expect(input.houseState.ghosts.length).toBeGreaterThan(0);
        const model = buildSceneModel(input);
        expect(model.ghosts).toHaveLength(0);
        expect(model.overflow.ghosts).toBe(0);
        expect(model.totals.ghosts).toBe(input.houseState.ghosts.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.1, 4.2, 4.8, 9.1, 9.2, 21.6**
  it("fills every cap and reports the rest as overflow at the input size limits", () => {
    fc.assert(
      fc.property(maxSceneInputArb, (input) => {
        const model = buildSceneModel(input);
        expect(model.zombies).toHaveLength(MAX_VISIBLE_ZOMBIES);
        expect(model.tombstones).toHaveLength(MAX_VISIBLE_TOMBSTONES);
        expect(model.overflow.zombies).toBeGreaterThan(0);
        expect(model.overflow.tombstones).toBeGreaterThan(0);
        if (input.houseState.poltergeist === null) {
          expect(model.ghosts).toHaveLength(MAX_VISIBLE_GHOSTS);
          expect(model.overflow.ghosts).toBeGreaterThan(0);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
