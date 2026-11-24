// Feature: house-scene, Property 2: Stable ghost phase
// **Validates: Requirements 3.4, 9.4**
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { buildSceneModel, FULL_TURN_RADIANS, GHOST_PHASE_STEPS, MAX_VISIBLE_GHOSTS, unitFromId } from "@/lib/scene";
import type { SceneGhost, SceneInput } from "@/lib/scene/types";
import type { Ghost } from "@/lib/haunting";
import { ghostArb, sceneInputArb } from "../arbitraries";

const NUM_RUNS = 200;
const MAX_INCOME_CENTS = 1_000_000_00;
const PHASE_EPSILON = 1e-9;

function withoutPoltergeist(input: SceneInput): SceneInput {
  return { ...input, houseState: { ...input.houseState, poltergeist: null } };
}

function ghostById(ghosts: SceneGhost[]): Map<string, SceneGhost> {
  return new Map(ghosts.map((g) => [g.id, g]));
}

/** The preferred phase of the design: 2π · unitFromId(id, "ghostPhase"). */
function preferredPhase(id: string): number {
  return FULL_TURN_RADIANS * unitFromId(id, "ghostPhase");
}

/** True when `phase` is the preferred phase plus a whole number of steps (mod 2π). */
function isCandidatePhase(id: string, phase: number): boolean {
  const step = FULL_TURN_RADIANS / GHOST_PHASE_STEPS;
  const offset = (((phase - preferredPhase(id)) % FULL_TURN_RADIANS) + FULL_TURN_RADIANS) % FULL_TURN_RADIANS;
  const k = offset / step;
  return Math.abs(k - Math.round(k)) < PHASE_EPSILON * GHOST_PHASE_STEPS;
}

function sceneWith(base: SceneInput, ghosts: Ghost[], income = base.monthlyIncomeCents): SceneInput {
  return { ...base, monthlyIncomeCents: income, houseState: { ...base.houseState, poltergeist: null, ghosts } };
}

describe("Property 2: Stable ghost phase", () => {
  it("keeps lane and bobPeriodMs for a ghost id across models, and its phase is always a step of its preferred phase", () => {
    fc.assert(
      fc.property(sceneInputArb, sceneInputArb, fc.integer({ min: 0, max: MAX_INCOME_CENTS }), (a, b, income) => {
        const inputA = withoutPoltergeist(a);
        const shared = [...inputA.houseState.ghosts].reverse();
        const inputB = sceneWith(b, [...b.houseState.ghosts, ...shared], income);
        const ghostsA = ghostById(buildSceneModel(inputA).ghosts);
        const ghostsB = ghostById(buildSceneModel(inputB).ghosts);
        for (const [id, ghostA] of ghostsA) {
          expect(isCandidatePhase(id, ghostA.phase)).toBe(true);
          const ghostB = ghostsB.get(id);
          if (!ghostB) continue;
          expect({ lane: ghostB.lane, bob: ghostB.bobPeriodMs }).toEqual({ lane: ghostA.lane, bob: ghostA.bobPeriodMs });
          expect(isCandidatePhase(id, ghostB.phase)).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("draws a lone ghost at exactly its preferred phase", () => {
    fc.assert(
      fc.property(sceneInputArb, ghostArb, fc.integer({ min: 0, max: MAX_INCOME_CENTS }), (base, ghost, income) => {
        const lone = buildSceneModel(sceneWith(base, [ghost], income)).ghosts[0];
        expect(lone?.id).toBe(ghost.transactionId);
        expect(lone?.phase).toBeCloseTo(preferredPhase(ghost.transactionId), 12);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("never moves a drawn ghost when companions with larger ids join", () => {
    fc.assert(
      fc.property(
        sceneInputArb,
        fc.uniqueArray(ghostArb, { minLength: 2, maxLength: MAX_VISIBLE_GHOSTS, selector: (g) => g.transactionId }),
        fc.nat({ max: MAX_VISIBLE_GHOSTS }),
        (base, ghosts, cut) => {
          const byId = [...ghosts].sort((x, y) => (x.transactionId < y.transactionId ? -1 : 1));
          const split = Math.max(1, Math.min(byId.length - 1, cut));
          const early = byId.slice(0, split);
          const before = ghostById(buildSceneModel(sceneWith(base, early)).ghosts);
          const after = ghostById(buildSceneModel(sceneWith(base, byId)).ghosts);
          for (const [id, ghost] of before) {
            expect(after.get(id)?.phase).toBe(ghost.phase);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
