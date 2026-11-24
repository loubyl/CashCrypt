// Feature: house-scene, Property 8: Poltergeist, bound state and posture
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildSceneModel } from "@/lib/scene";
import type { SceneInput, Usage } from "@/lib/scene/types";
import { anySceneInputArb, sceneInputArb } from "../arbitraries";

const NUM_RUNS = 200;
const MAX_TILT_DEG = 5;
const BADGE_BY_USAGE: Record<Usage, string> = { often: "flame", rarely: "hourglass", never: "skull" };
const USAGES: readonly Usage[] = ["often", "rarely", "never"];

function withBound(input: SceneInput, bound: boolean): SceneInput {
  return { ...input, bound };
}

describe("Property 8: Poltergeist, bound state and posture", () => {
  // **Validates: Requirements 8.2, 8.3, 8.4, 9.2**
  it("has a Poltergeist exactly when the engine reports one, and draws no ghosts then", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        const model = buildSceneModel(input);
        expect(model.poltergeist === null).toBe(input.houseState.poltergeist === null);
        if (model.poltergeist !== null) {
          expect(model.ghosts).toHaveLength(0);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 8.2, 8.3, 8.4**
  it("is bound exactly when the Poltergeist exists and the flag is true", () => {
    fc.assert(
      fc.property(sceneInputArb, fc.boolean(), (input, bound) => {
        const model = buildSceneModel(withBound(input, bound));
        if (input.houseState.poltergeist === null) {
          expect(model.poltergeist).toBeNull();
        } else {
          expect(model.poltergeist?.state).toBe(bound ? "bound" : "awake");
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 10.1, 10.3**
  it("gives each usage one posture and badge, different postures across usages, tilt within 5 degrees", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        const model = buildSceneModel(input);
        const postureByUsage = new Map<Usage, string>();
        const usageById = new Map(input.houseState.zombies.map((z) => [z.subscriptionId, z.usage]));
        for (const zombie of model.zombies) {
          expect(zombie.badge).toBe(BADGE_BY_USAGE[zombie.usage]);
          expect(Math.abs(zombie.tiltDeg)).toBeLessThanOrEqual(MAX_TILT_DEG);
          expect(zombie.usage).toBe(usageById.get(zombie.id));
          const seen = postureByUsage.get(zombie.usage);
          if (seen !== undefined) expect(zombie.posture).toBe(seen);
          postureByUsage.set(zombie.usage, zombie.posture);
        }
        for (const a of USAGES) {
          for (const b of USAGES) {
            const pa = postureByUsage.get(a);
            const pb = postureByUsage.get(b);
            if (a !== b && pa !== undefined && pb !== undefined) expect(pa).not.toBe(pb);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
