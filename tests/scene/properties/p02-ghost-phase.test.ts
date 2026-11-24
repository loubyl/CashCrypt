// Feature: house-scene, Property 2: Stable ghost phase
// **Validates: Requirements 3.4, 9.4**
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { buildSceneModel } from "@/lib/scene";
import type { SceneGhost, SceneInput } from "@/lib/scene/types";
import { ghostArb, sceneInputArb } from "../arbitraries";

const NUM_RUNS = 200;
const MAX_INCOME_CENTS = 1_000_000_00;

function withoutPoltergeist(input: SceneInput): SceneInput {
  return { ...input, houseState: { ...input.houseState, poltergeist: null } };
}

function ghostById(ghosts: SceneGhost[]): Map<string, SceneGhost> {
  return new Map(ghosts.map((g) => [g.id, g]));
}

function pickStable(g: SceneGhost) {
  return { phase: g.phase, lane: g.lane, bobPeriodMs: g.bobPeriodMs };
}

describe("Property 2: Stable ghost phase", () => {
  it("keeps phase, lane and bobPeriodMs for a ghost id across models with different companions and income", () => {
    fc.assert(
      fc.property(
        sceneInputArb,
        sceneInputArb,
        fc.integer({ min: 0, max: MAX_INCOME_CENTS }),
        (a, b, income) => {
          const inputA = withoutPoltergeist(a);
          // Model B shares ghosts of A (reversed, so the order differs) plus unrelated companions.
          const sharedGhosts = [...inputA.houseState.ghosts].reverse();
          const inputB: SceneInput = {
            ...withoutPoltergeist(b),
            monthlyIncomeCents: income,
            houseState: {
              ...b.houseState,
              poltergeist: null,
              ghosts: [...b.houseState.ghosts, ...sharedGhosts],
            },
          };
          const ghostsA = ghostById(buildSceneModel(inputA).ghosts);
          const ghostsB = ghostById(buildSceneModel(inputB).ghosts);
          for (const [id, ghostA] of ghostsA) {
            const ghostB = ghostsB.get(id);
            if (ghostB) expect(pickStable(ghostB)).toEqual(pickStable(ghostA));
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("always draws a lone ghost with the same phase, lane and bob period as in a crowded model", () => {
    fc.assert(
      fc.property(
        sceneInputArb,
        ghostArb,
        fc.integer({ min: 0, max: MAX_INCOME_CENTS }),
        (base, ghost, income) => {
          const alone: SceneInput = {
            ...base,
            monthlyIncomeCents: income,
            houseState: { ...base.houseState, poltergeist: null, ghosts: [ghost] },
          };
          const crowded: SceneInput = {
            ...base,
            houseState: {
              ...base.houseState,
              poltergeist: null,
              ghosts: [...base.houseState.ghosts, ghost],
            },
          };
          const lone = ghostById(buildSceneModel(alone).ghosts).get(ghost.transactionId);
          expect(lone).toBeDefined();
          const inCrowd = ghostById(buildSceneModel(crowded).ghosts).get(ghost.transactionId);
          if (lone && inCrowd) expect(pickStable(inCrowd)).toEqual(pickStable(lone));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
