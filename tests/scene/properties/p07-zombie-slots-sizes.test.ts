// Feature: house-scene, Property 7: Zombie slots are distinct and sizes are bounded and monotone
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  GHOST_SIZE_MAX,
  GHOST_SIZE_MIN,
  MAX_VISIBLE_ZOMBIES,
  ZOMBIE_HEIGHT_MAX,
  ZOMBIE_HEIGHT_MIN,
  buildSceneModel,
} from "@/lib/scene";
import type { Box } from "@/lib/scene/types";
import { sceneInputArb } from "../arbitraries";

const NUM_RUNS = 200;

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe("Property 7: zombie slots are distinct and sizes are bounded and monotone", () => {
  // **Validates: Requirements 5.5, 5.6**
  it("gives every drawn zombie a distinct slot below the cap", () => {
    fc.assert(
      fc.property(sceneInputArb, (input) => {
        const slots = buildSceneModel(input).zombies.map((z) => z.slot);
        expect(new Set(slots).size).toBe(slots.length);
        for (const slot of slots) {
          expect(slot).toBeGreaterThanOrEqual(0);
          expect(slot).toBeLessThan(MAX_VISIBLE_ZOMBIES);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 5.5, 5.6**
  it("keeps the boxes of drawn zombies pairwise disjoint", () => {
    fc.assert(
      fc.property(sceneInputArb, (input) => {
        const { zombies } = buildSceneModel(input);
        for (let i = 0; i < zombies.length; i++) {
          for (let j = i + 1; j < zombies.length; j++) {
            expect(boxesOverlap(zombies[i].box, zombies[j].box)).toBe(false);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 5.5, 5.6**
  it("keeps every zombie height within the configured range", () => {
    fc.assert(
      fc.property(sceneInputArb, (input) => {
        for (const zombie of buildSceneModel(input).zombies) {
          expect(zombie.heightUnits).toBeGreaterThanOrEqual(ZOMBIE_HEIGHT_MIN);
          expect(zombie.heightUnits).toBeLessThanOrEqual(ZOMBIE_HEIGHT_MAX);
          expect(zombie.box.h).toBe(zombie.heightUnits);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 5.5, 5.6**
  it("makes a zombie with a larger monthly cost at least as tall at the same income", () => {
    fc.assert(
      fc.property(sceneInputArb, (input) => {
        const costById = new Map(input.houseState.zombies.map((z) => [z.subscriptionId, z.monthlyCost]));
        const { zombies } = buildSceneModel(input);
        for (const a of zombies) {
          for (const b of zombies) {
            const costA = costById.get(a.id) as number;
            const costB = costById.get(b.id) as number;
            if (costA > costB) expect(a.heightUnits).toBeGreaterThanOrEqual(b.heightUnits);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 5.5, 5.6**
  it("keeps ghost sizes within range and non-decreasing in amount", () => {
    fc.assert(
      fc.property(sceneInputArb, (input) => {
        fc.pre(input.houseState.poltergeist === null);
        const amountById = new Map(input.houseState.ghosts.map((g) => [g.transactionId, g.amount]));
        const { ghosts } = buildSceneModel(input);
        for (const a of ghosts) {
          expect(a.sizeUnits).toBeGreaterThanOrEqual(GHOST_SIZE_MIN);
          expect(a.sizeUnits).toBeLessThanOrEqual(GHOST_SIZE_MAX);
          for (const b of ghosts) {
            if ((amountById.get(a.id) as number) > (amountById.get(b.id) as number)) {
              expect(a.sizeUnits).toBeGreaterThanOrEqual(b.sizeUnits);
            }
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
