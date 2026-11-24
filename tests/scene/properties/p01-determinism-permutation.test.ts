// Feature: house-scene, Property 1: Determinism and permutation invariance
// Validates: Requirements 3.2, 3.3

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { buildSceneModel } from "@/lib/scene";
import { anySceneInputArb, sceneInputWithPermutationArb } from "../arbitraries";

const NUM_RUNS = 100;

describe("Property 1: determinism and permutation invariance", () => {
  it("builds deeply equal models when called twice on the same input", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        expect(buildSceneModel(input)).toEqual(buildSceneModel(input));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("builds the same model when zombies, ghosts and graveyard are permuted", () => {
    fc.assert(
      fc.property(sceneInputWithPermutationArb, ({ input, permuted }) => {
        expect(buildSceneModel(permuted)).toEqual(buildSceneModel(input));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
