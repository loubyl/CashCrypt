// Feature: house-scene, Property 12: Scene summary states the true figures
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildSceneModel } from "@/lib/scene";
import { sceneInputArb } from "../arbitraries";

const NUM_RUNS = 200;

/** "no zombies", "1 zombie" or "N zombies". */
function phrase(count: number, singular: string, plural: string): string {
  if (count === 0) return `no ${plural}`;
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

describe("Property 12: scene summary states the true figures", () => {
  // **Validates: Requirements 4.8, 8.6, 10.6, 19.2**
  it("starts with the level and name and states the true totals with correct plurals", () => {
    fc.assert(
      fc.property(sceneInputArb, (input) => {
        const model = buildSceneModel(input);
        const zombies = input.houseState.zombies.length;
        const ghosts = input.houseState.ghosts.length;
        const tombstones = input.graveyard.length;
        const prefix = `Level ${input.houseState.decayLevel}, ${model.levelName}. `;
        expect(model.summary.startsWith(prefix)).toBe(true);
        const clauses = model.summary.slice(prefix.length).split(", ");
        expect(clauses[0]).toBe(phrase(zombies, "zombie", "zombies"));
        expect(clauses[1]).toBe(phrase(ghosts, "ghost", "ghosts"));
        expect(clauses[clauses.length - 1]).toBe(phrase(tombstones, "tombstone", "tombstones"));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.8, 8.6, 10.6, 19.2**
  it("has a Poltergeist clause exactly when the Poltergeist exists, in its state", () => {
    fc.assert(
      fc.property(sceneInputArb, (input) => {
        const { summary } = buildSceneModel(input);
        const clauses = summary.slice(summary.indexOf(". ") + 2).split(", ");
        const poltergeistClauses = clauses.filter((c) => c.includes("Poltergeist"));
        if (input.houseState.poltergeist === null) {
          expect(poltergeistClauses).toEqual([]);
          expect(clauses).toHaveLength(3);
        } else {
          const state = input.bound ? "bound" : "awake";
          expect(poltergeistClauses).toEqual([`Poltergeist ${state}`]);
          expect(clauses).toHaveLength(4);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
