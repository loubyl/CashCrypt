// Feature: house-scene, Property 20: Ghost rests are spread unless the lane is crowded
// **Validates: Requirements 3.4, 9.4, 9.7**
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  FULL_TURN_RADIANS,
  GHOST_MIN_REST_DISTANCE,
  GHOST_PHASE_STEPS,
  MAX_VISIBLE_GHOSTS,
  buildSceneModel,
  getLanePoint,
  unitFromId,
} from "@/lib/scene";
import type { SceneGhost, SceneInput } from "@/lib/scene/types";
import type { Ghost } from "@/lib/haunting";
import { emptySceneInputArb, ghostArb } from "../arbitraries";

const NUM_RUNS = 300;

/** Ids like the demo and the app produce: one prefix and a counter, or uuids. */
const idSetArb: fc.Arbitrary<string[]> = fc.oneof(
  fc
    .tuple(fc.stringMatching(/^[a-z:-]{0,16}$/), fc.uniqueArray(fc.nat({ max: 999 }), { minLength: 2, maxLength: MAX_VISIBLE_GHOSTS }))
    .map(([prefix, counters]) => counters.map((n) => `${prefix}${n}`)),
  fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: MAX_VISIBLE_GHOSTS }),
);

const inputArb: fc.Arbitrary<SceneInput> = fc
  .tuple(emptySceneInputArb, idSetArb, fc.array(ghostArb, { minLength: MAX_VISIBLE_GHOSTS, maxLength: MAX_VISIBLE_GHOSTS }))
  .map(([base, ids, templates]) => {
    const ghosts: Ghost[] = ids.map((id, i) => ({ ...templates[i], transactionId: id }));
    return { ...base, houseState: { ...base.houseState, poltergeist: null, ghosts } };
  });

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Independent check of "crowded": every candidate rest of `ghost` (its preferred phase plus
 * whole steps, on its own lane) is closer than the minimum to a drawn ghost with a smaller id.
 */
function isCrowded(ghost: SceneGhost, drawn: readonly SceneGhost[]): boolean {
  const earlier = drawn.filter((other) => other.id < ghost.id);
  const preferred = FULL_TURN_RADIANS * unitFromId(ghost.id, "ghostPhase");
  const step = FULL_TURN_RADIANS / GHOST_PHASE_STEPS;
  return Array.from({ length: GHOST_PHASE_STEPS }, (_, k) => getLanePoint(ghost.orbit, preferred + k * step)).every(
    (candidate) => earlier.some((other) => distance(candidate, other.rest) < GHOST_MIN_REST_DISTANCE),
  );
}

describe("Property 20: ghost rests are spread unless the lane is crowded", () => {
  it("keeps every pair of drawn ghosts at least the minimum apart, except when the later one had no free step", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const drawn = buildSceneModel(input).ghosts;
        for (let i = 0; i < drawn.length; i += 1) {
          for (let j = i + 1; j < drawn.length; j += 1) {
            if (distance(drawn[i].rest, drawn[j].rest) >= GHOST_MIN_REST_DISTANCE) continue;
            const later = drawn[i].id > drawn[j].id ? drawn[i] : drawn[j];
            expect(isCrowded(later, drawn)).toBe(true);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
