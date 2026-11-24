// Feature: house-scene, Property 6: Drawn items are the best-ranked prefix
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildSceneModel } from "@/lib/scene";
import { maxSceneInputArb, sceneInputArb } from "../arbitraries";

const NUM_RUNS = 200;
const SAME = 0;

/** Locale-free string order, independent of the implementation. */
function byAscending(a: string, b: string): number {
  if (a === b) return SAME;
  return a < b ? -1 : 1;
}

/** Valid inputs, plus inputs at the size limits so the cap actually cuts the list. */
const validInputArb = fc.oneof(sceneInputArb, maxSceneInputArb);

describe("Property 6: drawn items are the best-ranked prefix", () => {
  // **Validates: Requirements 4.5, 4.6, 4.7, 11.1**
  it("draws the zombies with the highest monthly cost first, ties by id ascending", () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const model = buildSceneModel(input);
        const expected = [...input.houseState.zombies]
          .sort((a, b) => b.monthlyCost - a.monthlyCost || byAscending(a.subscriptionId, b.subscriptionId))
          .slice(0, model.zombies.length)
          .map((z) => z.subscriptionId);
        expect(model.zombies.map((z) => z.id)).toEqual(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.5, 4.6, 4.7, 11.1**
  it("draws the largest ghosts first, ties by id ascending, while no Poltergeist exists", () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        fc.pre(input.houseState.poltergeist === null);
        const model = buildSceneModel(input);
        const expected = [...input.houseState.ghosts]
          .sort((a, b) => b.amount - a.amount || byAscending(a.transactionId, b.transactionId))
          .slice(0, model.ghosts.length)
          .map((g) => g.transactionId);
        expect(model.ghosts.map((g) => g.id)).toEqual(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.5, 4.6, 4.7, 11.1**
  it("draws the most recently canceled tombstones first, ties by id ascending", () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const model = buildSceneModel(input);
        const expected = [...input.graveyard]
          .sort((a, b) => byAscending(b.canceledOn, a.canceledOn) || byAscending(a.subscriptionId, b.subscriptionId))
          .slice(0, model.tombstones.length)
          .map((e) => e.subscriptionId);
        expect(model.tombstones.map((t) => t.id)).toEqual(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 4.5, 4.6, 4.7, 11.1**
  it("breaks ties by id when every item has the same cost, amount and date", () => {
    fc.assert(
      fc.property(maxSceneInputArb, (input) => {
        const flat = {
          ...input,
          houseState: {
            ...input.houseState,
            poltergeist: null,
            zombies: input.houseState.zombies.map((z) => ({ ...z, monthlyCost: 500 })),
            ghosts: input.houseState.ghosts.map((g) => ({ ...g, amount: 500 })),
          },
          graveyard: input.graveyard.map((e) => ({ ...e, canceledOn: "2030-01-01" })),
        };
        const model = buildSceneModel(flat);
        const firstIds = (ids: string[], count: number) => [...ids].sort(byAscending).slice(0, count);
        expect(model.zombies.map((z) => z.id)).toEqual(
          firstIds(flat.houseState.zombies.map((z) => z.subscriptionId), model.zombies.length),
        );
        expect(model.ghosts.map((g) => g.id)).toEqual(
          firstIds(flat.houseState.ghosts.map((g) => g.transactionId), model.ghosts.length),
        );
        expect(model.tombstones.map((t) => t.id)).toEqual(
          firstIds(flat.graveyard.map((e) => e.subscriptionId), model.tombstones.length),
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
